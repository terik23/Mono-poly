/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { BOARD_SPACES } from './constants';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { 
  Building2, 
  MapPin, 
  Wallet, 
  Dice5, 
  History, 
  Users, 
  Send,
  Home,
  Landmark,
  Timer,
  Plane,
  Menu,
  X
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, addMinutes, isAfter } from 'date-fns';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Player {
  id: string;
  game_id: string;
  name: string;
  balance: number;
  position: number;
  last_roll_at: string | null;
  last_daily_at: string;
  player_color: string;
  rolls_remaining: number; // New: Add to your Supabase table
  last_recharge_at: string; // New: Add to your Supabase table
}

interface PropertyOwnership {
  space_id: number;
  owner_id: string | null;
  buildings: number;
}

const PLAYER_COLORS = [
  '#dc2626', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#db2777', '#0891b2'
];

export default function Game() {
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [properties, setProperties] = useState<PropertyOwnership[]>([]);
  const [gameId] = useState('global-tycoon-world');
  const [isJoined, setIsJoined] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [rolling, setRolling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [diceVisual, setDiceVisual] = useState([1]);
  const [showSidebar, setShowSidebar] = useState(false);

  const fetchData = useCallback(async (gid: string) => {
    try {
      const { data: pData, error: pError } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', gid);
      
      if (pError) throw pError;
      if (pData) setPlayers(pData);

      const { data: propData, error: propError } = await supabase
        .from('properties')
        .select('*')
        .eq('game_id', gid);
      
      if (propError) throw propError;
      if (propData) setProperties(propData);
    } catch (e: any) {
      console.error("Fetch Data Error:", e);
      setErrorMsg(`Data Synchronization Error: ${e.message}`);
    }
  }, []);

  const rechargeRolls = useCallback(async (player: Player) => {
    const lastRecharge = new Date(player.last_recharge_at);
    const now = new Date();
    const diffMs = now.getTime() - lastRecharge.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins >= 30 && player.rolls_remaining < 5) {
      const { data } = await supabase
        .from('players')
        .update({ 
          rolls_remaining: 5, 
          last_recharge_at: now.toISOString() 
        })
        .eq('id', player.id)
        .select()
        .single();
      if (data) setCurrentPlayer(data);
    }
  }, []);

  useEffect(() => {
    if (currentPlayer) {
      rechargeRolls(currentPlayer);
    }
  }, [currentPlayer, rechargeRolls]);

  // Sync logs to Supabase Storage "Server" bucket
  const syncLogsToStorage = useCallback(async (newLogs: string[]) => {
    if (newLogs.length === 0) return;
    
    // Simple obfuscation to simulate "encrypted" JSON as requested
    const logData = JSON.stringify({
      timestamp: new Date().toISOString(),
      entries: newLogs,
      environment: 'production-v1'
    });
    
    const encryptedData = btoa(unescape(encodeURIComponent(logData)));

    try {
      const { error } = await supabase.storage
        .from('Server')
        .upload(`logs/world_events_${new Date().getTime()}.json`, encryptedData, {
          cacheControl: '3600',
          upsert: true
        });
      if (error) console.warn("Storage sync failed:", error.message);
    } catch (e) {
      console.error("Log sync error:", e);
    }
  }, []);

  useEffect(() => {
    if (logs.length > 0 && logs.length % 5 === 0) {
      syncLogsToStorage(logs);
    }
  }, [logs, syncLogsToStorage]);

  useEffect(() => {
    // Robust real-time subscription
    const channel = supabase
      .channel(`world-sync-${gameId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'players'
      }, (payload) => {
        if (payload.new && (payload.new as Player).game_id === gameId) {
          const updatedPlayer = payload.new as Player;
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setPlayers(prev => {
              const exists = prev.find(p => p.id === updatedPlayer.id);
              if (exists) {
                return prev.map(p => p.id === updatedPlayer.id ? updatedPlayer : p);
              }
              return [...prev, updatedPlayer];
            });
            
            // If it's the current player, update their local state too
            setCurrentPlayer(current => {
              if (current && updatedPlayer.id === current.id) {
                // Merge to preserve local temporary states if any
                return { ...current, ...updatedPlayer };
              }
              return current;
            });
          }
        }
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'properties'
      }, (payload) => {
        if (payload.new && (payload.new as PropertyOwnership).game_id === gameId) {
          const updatedProp = payload.new as PropertyOwnership;
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setProperties(prev => {
              const exists = prev.find(p => p.space_id === updatedProp.space_id);
              if (exists) {
                return prev.map(p => p.space_id === updatedProp.space_id ? updatedProp : p);
              }
              return [...prev, updatedProp];
            });
          } else if (payload.eventType === 'DELETE') {
            // Handle property sales
            fetchData(gameId);
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log("Realtime connected for game:", gameId);
        }
      });

    // Periodic cleanup/sync check
    const syncInterval = setInterval(() => fetchData(gameId), 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(syncInterval);
    };
  }, [gameId, fetchData]);

  const joinGame = async () => {
    if (!playerName) return;
    setErrorMsg(null);

    try {
      const { data: existingPlayer, error: checkError } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', gameId)
        .eq('name', playerName)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingPlayer) {
        setCurrentPlayer(existingPlayer);
        setIsJoined(true);
        fetchData(gameId);
        return;
      }

      const newPlayer = {
        game_id: gameId,
        name: playerName,
        balance: 1500,
        position: 0,
        player_color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)],
        last_daily_at: new Date().toISOString(),
        rolls_remaining: 5,
        last_recharge_at: new Date().toISOString()
      };

      const { data, error: insertError } = await supabase
        .from('players')
        .insert(newPlayer)
        .select()
        .single();

      if (insertError) throw insertError;

      if (data) {
        setCurrentPlayer(data);
        setIsJoined(true);
        fetchData(gameId);
        setLogs(prev => [`TYCOON ${playerName.toUpperCase()} INITIALIZED`, ...prev]);
      }
    } catch (e: any) {
      console.error("Join Game Error:", e);
      setErrorMsg(`Join Failed: ${e.message || 'Check your Supabase configuration and tables.'}`);
    }
  };

  const rollDice = async () => {
    if (!currentPlayer || rolling) return;

    const currentRolls = currentPlayer.rolls_remaining ?? 5;
    if (currentRolls <= 0) {
      const nextRecharge = addMinutes(new Date(currentPlayer.last_recharge_at), 30);
      const timeRemaining = formatDistanceToNow(nextRecharge);
      setLogs(prev => [`0 ROLLS REMAINING. RECHARGE IN ${timeRemaining.toUpperCase()}`, ...prev]);
      return;
    }

    setRolling(true);
    
    // Dice animation shuffle
    for(let i = 0; i < 10; i++) {
      setDiceVisual([Math.floor(Math.random() * 6) + 1]);
      await new Promise(r => setTimeout(r, 60));
    }

    const d1 = Math.floor(Math.random() * 6) + 1;
    setDiceVisual([d1]);
    const move = d1;
    
    let nextPos = (currentPlayer.position + move) % 40;
    let balance = currentPlayer.balance;

    const lastDaily = new Date(currentPlayer.last_daily_at);
    if (new Date().getTime() - lastDaily.getTime() > 24 * 60 * 60 * 1000) {
      balance += 100;
      setLogs(prev => [`DAILY DIVIDEND $100 GRANTED`, ...prev]);
    }

    if (nextPos < currentPlayer.position) {
      balance += 200;
      setLogs(prev => [`PASSED GO! ACQUIRED $200`, ...prev]);
    }

    const space = BOARD_SPACES[nextPos];
    setLogs(prev => [`ROLLED ${move}! ARRIVED AT ${space.name.toUpperCase()}`, ...prev]);

    // Optimistic Local Update for instant movement
    const updatedPlayer = { 
      ...currentPlayer, 
      position: nextPos, 
      balance: balance,
      rolls_remaining: Math.max(0, currentRolls - 1),
      last_roll_at: new Date().toISOString()
    } as Player;
    
    setCurrentPlayer(updatedPlayer);
    setPlayers(prev => prev.map(p => p.id === currentPlayer.id ? updatedPlayer : p));

    const ownership = properties.find(p => p.space_id === nextPos);
    if (ownership && ownership.owner_id && ownership.owner_id !== currentPlayer.id) {
      const owner = players.find(p => p.id === ownership.owner_id);
      if (owner) {
        const rent = space.rent ? space.rent[ownership.buildings] : 20;
        balance -= rent;
        await supabase
          .from('players')
          .update({ balance: owner.balance + rent })
          .eq('id', owner.id);
        setLogs(prev => [`PAID $${rent} RENT TO ${owner.name.toUpperCase()}`, ...prev]);
      }
    }

    await supabase
      .from('players')
      .update({ 
        position: nextPos, 
        balance: balance,
        last_roll_at: new Date().toISOString(),
        rolls_remaining: Math.max(0, currentRolls - 1),
        last_daily_at: balance > currentPlayer.balance ? new Date().toISOString() : currentPlayer.last_daily_at
      })
      .eq('id', currentPlayer.id);

    setRolling(false);
  };

  const buyProperty = async (spaceId: number) => {
    if (!currentPlayer) return;
    const space = BOARD_SPACES[spaceId];
    if (!space.price || currentPlayer.balance < space.price) return;

    const { error: propError } = await supabase
      .from('properties')
      .insert({ 
        space_id: spaceId, 
        game_id: gameId, 
        owner_id: currentPlayer.id,
        buildings: 0
      });

    if (!propError) {
      setLogs(prev => [`Bought ${space.name} for $${space.price}`, ...prev]);
      await supabase
        .from('players')
        .update({ balance: currentPlayer.balance - space.price })
        .eq('id', currentPlayer.id);
    }
  };

  const buildHouse = async (spaceId: number) => {
    const space = BOARD_SPACES[spaceId];
    const ownership = properties.find(p => p.space_id === spaceId);
    if (!ownership || ownership.owner_id !== currentPlayer?.id || ownership.buildings >= 5) return;
    
    const houseCost = Math.floor((space.price || 100) * 0.5);
    if (currentPlayer.balance < houseCost) return;

    await supabase
      .from('properties')
      .update({ buildings: ownership.buildings + 1 })
      .eq('space_id', spaceId)
      .eq('game_id', gameId);

    await supabase
      .from('players')
      .update({ balance: currentPlayer.balance - houseCost })
      .eq('id', currentPlayer.id);

    setLogs(prev => [`Upgraded ${space.name} for $${houseCost}`, ...prev]);
  };

  const sellProperty = async (spaceId: number) => {
    if (!currentPlayer) return;
    const ownership = properties.find(p => p.space_id === spaceId && p.owner_id === currentPlayer.id);
    if (!ownership) return;

    const space = BOARD_SPACES[spaceId];
    const sellPrice = Math.floor((space.price || 0) / 2);

    const { error: delError } = await supabase
      .from('properties')
      .delete()
      .eq('space_id', spaceId)
      .eq('game_id', gameId);

    if (!delError) {
      const newBalance = currentPlayer.balance + sellPrice;
      await supabase
        .from('players')
        .update({ balance: newBalance })
        .eq('id', currentPlayer.id);
      
      setLogs(prev => [`SOLD ${space.name.toUpperCase()} FOR $${sellPrice}`, ...prev]);
    }
  };

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-[#fcfcf9] flex items-center justify-center p-4 font-sans text-gray-900 overflow-hidden">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-10 rounded-sm shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] w-full max-w-md border border-black/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.2)]" />
          <div className="flex flex-col items-center mb-10">
            <div className="w-24 h-24 bg-gray-50 border border-black/[0.03] rounded-full flex items-center justify-center mb-8 shadow-inner">
              <Dice5 className="text-blue-600 w-12 h-12" />
            </div>
            <h1 className="text-5xl font-serif italic text-black tracking-widest text-center">TYCOON</h1>
            <p className="text-[11px] uppercase tracking-[0.4em] opacity-40 text-center mt-4 font-black">Classic Board Game</p>
          </div>
          <div className="space-y-8">
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-widest opacity-40 font-black ml-1 text-blue-600">Your Name</label>
              <input type="text" placeholder="NAME" className="w-full px-8 py-5 bg-gray-50 border border-gray-200 rounded-2xl text-black placeholder:opacity-30 focus:border-blue-500/50 transition-all outline-none font-mono uppercase text-sm shadow-inner" value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
            </div>
            {errorMsg && (
              <div className="p-5 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[10px] font-mono leading-relaxed">
                <span className="font-bold uppercase block mb-1">Error:</span>
                {errorMsg}
              </div>
            )}
            <button onClick={joinGame} disabled={!playerName} className="w-full py-6 bg-black text-white font-black uppercase tracking-[0.3em] text-sm rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-30">Start Game</button>
          </div>
          <p className="mt-10 text-[10px] text-center opacity-30 uppercase tracking-[0.2em] font-black">Syncing: Online</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#fcfcf9] text-gray-900 font-sans flex flex-col overflow-hidden select-none">
      {/* Top Header */}
      <header className="h-16 border-b border-black/5 bg-white px-4 md:px-8 flex items-center justify-between shadow-sm z-20 shrink-0">
        <div className="flex items-center space-x-4 md:space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse shadow-[0_0_8px_rgba(37,99,235,0.4)]"></div>
            <span className="text-[9px] font-bold tracking-widest uppercase opacity-70 font-mono hidden sm:inline">Online</span>
          </div>
          <div className="h-8 w-[1px] bg-black/5 hidden sm:block"></div>
          <div className="flex flex-col">
            <span className="text-[8px] uppercase tracking-widest opacity-40 font-bold">Balance</span>
            <span className="text-lg md:text-xl font-mono text-blue-700 font-bold leading-none">${currentPlayer?.balance.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex items-center space-x-4 md:space-x-8 italic font-serif">
          <button 
            onClick={() => setShowSidebar(!showSidebar)}
            className="md:hidden p-2 bg-gray-50 border border-black/5 rounded-sm"
          >
            {showSidebar ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="text-right hidden sm:block">
            <span className="block text-[8px] not-italic uppercase tracking-widest opacity-40 font-bold mb-1">Location</span>
            <span className="text-gray-600 text-sm">{BOARD_SPACES[currentPlayer?.position || 0].name}</span>
          </div>
          <div className="w-[1px] h-8 bg-black/5 hidden sm:block"></div>
          <div className="flex items-center gap-3">
             <div className="flex flex-col text-right">
                <span className="text-[8px] not-italic uppercase tracking-widest opacity-40 font-bold">Player</span>
                <span className="text-black text-[10px] md:text-xs font-bold font-sans uppercase tracking-tight">{currentPlayer?.name}</span>
             </div>
             <div className="w-9 h-9 md:w-10 md:h-10 rounded-sm border border-black/5 flex items-center justify-center text-xs font-mono shadow-sm" style={{ backgroundColor: currentPlayer?.player_color + '22', color: currentPlayer?.player_color }}>
                {currentPlayer?.name.charAt(0)}
             </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Game Area */}
        <div className="flex-1 flex items-center justify-center p-2 md:p-6 bg-[#f0f0f0] overflow-hidden relative">
          <LayoutGroup>
            <div className="relative aspect-square w-full max-w-[min(100vw,92vh,1100px)] bg-[#DAEED6] border-[16px] border-[#c1d9bc] rounded-2xl shadow-[0_60px_150px_rgba(0,0,0,0.2)] ring-1 ring-black/[0.1]">
              <div className="grid grid-cols-11 grid-rows-11 h-full w-full p-2">
              {BOARD_SPACES.map((space) => {
                const isCorner = space.type === 'corner';
                let gridArea = "";
                if (space.id === 0) gridArea = "11 / 11";
                else if (space.id <= 9) gridArea = `11 / ${11 - space.id}`;
                else if (space.id === 10) gridArea = "11 / 1";
                else if (space.id <= 19) gridArea = `${11 - (space.id - 10)} / 1`;
                else if (space.id === 20) gridArea = "1 / 1";
                else if (space.id <= 29) gridArea = `1 / ${space.id - 19}`;
                else if (space.id === 30) gridArea = "1 / 11";
                else gridArea = `${space.id - 29} / 11`;

                const ownership = properties.find(p => p.space_id === space.id);
                const owner = ownership ? players.find(p => p.id === ownership.owner_id) : null;

                return (
                  <div key={space.id} style={{ gridArea }} className={cn(
                    "border-[0.5px] border-black/5 relative flex flex-col items-center bg-white transition-colors overflow-hidden group",
                    isCorner && "bg-gray-50"
                  )}>
                    {space.color && (
                      <div className={cn(
                        "absolute w-full h-[15%]", 
                        space.id < 10 && "top-0", 
                        space.id > 10 && space.id < 20 && "right-0 h-full w-[15%]", 
                        space.id > 20 && space.id < 30 && "bottom-0", 
                        space.id > 30 && "left-0 h-full w-[15%]"
                      )} style={{ backgroundColor: space.color + 'dd' }} />
                    )}
                    
                    <div className="z-10 p-0.5 md:p-1 flex flex-col items-center justify-center h-full w-full text-center">
                      <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-tight text-gray-900 leading-tight">
                        {space.name}
                      </span>
                      {space.price && <span className="text-[7px] md:text-[9px] font-mono text-black/50 mt-auto font-bold">${space.price}</span>}
                    </div>

                    {ownership && ownership.buildings > 0 && (
                      <div className="absolute top-1 right-1 flex gap-0.5 bg-white/80 rounded-[1px] p-0.5 border border-black/5 shadow-sm">
                        {Array.from({ length: ownership.buildings }).map((_, i) => <Building2 key={i} className={cn("w-1.5 h-1.5 md:w-2 md:h-2", i === 4 ? "text-red-500" : "text-blue-600")} />)}
                      </div>
                    )}

                    {owner && (
                      <div className="absolute bottom-0 left-0 w-full h-0.5 md:h-1" style={{ backgroundColor: owner.player_color }} />
                    )}

                    {/* Player Tokens (Planes) */}
                    <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-1 z-30 pointer-events-none p-1">
                      <AnimatePresence>
                        {players.filter(p => p.position === space.id).map(p => (
                          <motion.div 
                            key={p.id} 
                            layoutId={`player-token-${p.id}`} 
                            initial={{ scale: 0, rotate: -45, y: -20 }}
                            animate={{ 
                              scale: 1, 
                              rotate: 0,
                              y: 0
                            }}
                            exit={{ scale: 0, y: -20 }}
                            transition={{ 
                              type: "spring", 
                              stiffness: 150, 
                              damping: 20,
                              layout: {
                                duration: 1.2,
                                ease: "anticipate"
                              }
                            }}
                            className="z-40 drop-shadow-[0_15px_30px_rgba(0,0,0,0.4)]"
                          >
                            <Plane 
                              className="w-7 h-7 md:w-12 md:h-12" 
                              style={{ 
                                fill: p.player_color, 
                                stroke: 'white', 
                                strokeWidth: 2,
                                filter: 'drop-shadow(0px 6px 12px rgba(0,0,0,0.5))'
                              }} 
                            />
                            {/* Directional Indicator or Shadow */}
                            <motion.div 
                               initial={{ opacity: 0 }}
                               animate={{ opacity: 0.3 }}
                               className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-1 bg-black rounded-full blur-[2px]" 
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}

              {/* Center Dashboard */}
              <div className="col-start-2 col-end-11 row-start-2 row-end-11 flex flex-col items-center justify-center p-4">
                <div className="text-center mb-8 md:mb-12">
                   <h1 className="text-[5vw] lg:text-[5rem] font-serif italic text-black/[0.05] tracking-[0.1em] leading-none mb-1 md:mb-4 select-none">TYCOON</h1>
                   <p className="text-[8px] md:text-[10px] uppercase tracking-[0.6em] opacity-30 font-black italic">Classic Edition</p>
                </div>

                {currentPlayer && (
                  <div className="relative pointer-events-auto">
                    <div className="relative bg-white/95 backdrop-blur-xl border border-black/5 p-5 md:p-12 rounded-3xl flex flex-col items-center min-w-[280px] md:min-w-[400px] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] ring-1 ring-black/[0.03]">
                      <div className="text-[10px] md:text-sm uppercase tracking-[0.5em] font-black opacity-30 mb-8 md:mb-12">YOUR TURN</div>
                      
                      <div className="flex gap-8 md:gap-12 mb-8 md:mb-14">
                         <motion.div 
                          animate={rolling ? { 
                            rotateY: [0, 180, 360, 540, 720],
                            scale: [1, 1.4, 0.9, 1.2, 1],
                            z: [0, 50, -50, 20, 0]
                          } : {}}
                          transition={{ duration: 0.5, repeat: rolling ? Infinity : 0, ease: "easeInOut" }}
                          className="w-24 h-24 md:w-40 md:h-40 bg-white border border-black/10 rounded-3xl flex items-center justify-center shadow-xl relative preserve-3d"
                         >
                            <div className="absolute inset-0 bg-gradient-to-br from-white via-gray-50 to-gray-100 rounded-3xl" />
                            <span className="relative z-10 text-5xl md:text-8xl font-mono text-black font-black drop-shadow-md">{diceVisual[0]}</span>
                         </motion.div>
                      </div>

                      <button 
                        onClick={rollDice} 
                        disabled={rolling || currentPlayer.rolls_remaining <= 0} 
                        className="px-12 md:px-20 py-5 md:py-8 bg-blue-600 text-white font-black uppercase tracking-[0.4em] text-[12px] md:text-lg hover:bg-black transition-all disabled:opacity-20 disabled:cursor-not-allowed rounded-full w-full shadow-2xl active:scale-95 flex items-center justify-center gap-4"
                      >
                        {rolling ? (
                          <div className="flex gap-2">
                             <div className="w-2 h-2 bg-white rounded-full animate-bounce" />
                             <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:0.2s]" />
                             <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:0.4s]" />
                          </div>
                        ) : "ROLL DICE"}
                      </button>

                      <div className="mt-8 md:mt-12 flex flex-col items-center gap-3">
                        <div className="flex gap-3">
                          {[...Array(5)].map((_, i) => (
                            <motion.div 
                              key={i} 
                              animate={i < (currentPlayer.rolls_remaining ?? 5) ? { 
                                scale: [1, 1.3, 1],
                                opacity: 1
                              } : { opacity: 0.2 }}
                              className={cn("w-4 h-4 rounded-full border-2 border-white shadow-lg", i < (currentPlayer.rolls_remaining ?? 5) ? "bg-blue-600" : "bg-gray-200")} 
                            />
                          ))}
                        </div>
                        <span className="text-[10px] font-black opacity-30 uppercase tracking-[0.3em]">{currentPlayer.rolls_remaining ?? 5} ROLLS LEFT</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </LayoutGroup>
        </div>

        {/* Sidebar Controls */}
        <aside className={cn(
          "fixed inset-y-0 right-0 z-30 w-full md:w-[320px] lg:w-[400px] bg-white border-l border-black/5 flex flex-col shadow-2xl p-4 md:p-10 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:shadow-none",
          showSidebar ? "translate-x-0" : "translate-x-full"
        )}>
          <div className="flex justify-between items-center md:hidden mb-6">
             <span className="text-xs font-black uppercase tracking-widest opacity-30">Game Menu</span>
             <button onClick={() => setShowSidebar(false)}><X className="w-6 h-6" /></button>
          </div>
          <div className="flex-1 flex flex-col gap-8 md:gap-12 overflow-y-auto custom-scrollbar">
            {/* Reserves & Context */}
            <div className="space-y-6">
               <div className="flex justify-between items-end border-b border-black/5 pb-2">
                 <span className="text-[10px] uppercase tracking-widest font-black opacity-20">Location Info</span>
                 <span className="text-xs font-serif italic text-gray-600">{BOARD_SPACES[currentPlayer?.position || 0].name} ({BOARD_SPACES[currentPlayer?.position || 0].type})</span>
               </div>
               
               <div className="bg-gray-50/80 border border-black/[0.03] p-6 rounded-[1px] relative">
                 <div className="flex flex-col gap-1">
                   <span className="text-[8px] uppercase tracking-widest opacity-40 font-black">Cash Balance</span>
                   <span className="text-4xl font-mono text-black font-black tracking-tight">${currentPlayer?.balance.toLocaleString()}</span>
                 </div>
                 <div className="mt-4 flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-[9px] uppercase font-black opacity-30 tracking-widest">
                       <span>Daily Bonus</span>
                       <span>Daily</span>
                    </div>
                    <div className="w-full h-0.5 bg-gray-200 rounded-full overflow-hidden">
                       <div className="h-full bg-amber-500 w-[60%]" />
                    </div>
                 </div>
               </div>
            </div>

            {/* Location Interaction */}
            {currentPlayer && BOARD_SPACES[currentPlayer.position].type === 'property' && (
              <div className="space-y-6">
                <div className="text-[10px] uppercase tracking-widest font-black opacity-20">Property Actions</div>
                <div className="p-5 bg-gray-50 border border-black/[0.03] rounded-xl space-y-4">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tight">
                    <span className="opacity-40">Group</span>
                    <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{BOARD_SPACES[currentPlayer.position].color || 'Infrastructure'}</span>
                  </div>
                  
                  <div className="space-y-3">
                    {!properties.find(p => p.space_id === currentPlayer.position) ? (
                      <button 
                        onClick={() => buyProperty(currentPlayer.position)} 
                        disabled={currentPlayer.balance < (BOARD_SPACES[currentPlayer.position].price || 0)} 
                        className="w-full py-5 bg-black text-white font-black uppercase text-xs tracking-[0.2em] hover:bg-blue-600 transition-all disabled:opacity-20 rounded-xl shadow-xl flex items-center justify-center gap-3"
                      >
                        BUY · ${BOARD_SPACES[currentPlayer.position].price}
                      </button>
                    ) : properties.find(p => p.space_id === currentPlayer.position)?.owner_id === currentPlayer.id ? (
                      <button 
                        onClick={() => buildHouse(currentPlayer.position)} 
                        disabled={currentPlayer.balance < Math.floor((BOARD_SPACES[currentPlayer.position].price || 100) * 0.5) || (properties.find(p => p.space_id === currentPlayer.position)?.buildings || 0) >= 5} 
                        className="w-full py-5 bg-blue-600 text-white font-black uppercase text-xs tracking-[0.2em] hover:bg-black transition-all disabled:opacity-20 rounded-xl shadow-xl flex items-center justify-center gap-3"
                      >
                        <Building2 className="w-5 h-5" /> BUILD (${Math.floor((BOARD_SPACES[currentPlayer.position].price || 100) * 0.5)})
                      </button>
                    ) : (
                      <div className="py-8 bg-white border border-gray-100 rounded-xl flex flex-col items-center justify-center gap-2">
                        <Landmark className="w-8 h-8 opacity-10" />
                        <span className="text-[10px] uppercase tracking-widest opacity-30 font-black italic">Owned by someone else</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Asset Portfolio */}
            {currentPlayer && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-widest font-black opacity-20">MY PROPERTIES</div>
                  <div className="text-[9px] font-mono font-bold opacity-30">
                    {properties.filter(p => p.owner_id === currentPlayer.id).length} PROPERTIES
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {properties.filter(p => p.owner_id === currentPlayer.id).map(prop => {
                    const space = BOARD_SPACES[prop.space_id];
                    return (
                      <div key={prop.space_id} className="flex items-center justify-between p-3 bg-white border border-black/[0.03] rounded-xl hover:border-blue-600/30 transition-all group relative overflow-hidden">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-8 rounded-full" style={{ backgroundColor: space.color || '#cbd5e1' }} />
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-tight text-gray-800">{space.name}</span>
                            <div className="flex gap-1 mt-0.5">
                              {[...Array(prop.buildings)].map((_, i) => (
                                <div key={i} className="w-1.5 h-1.5 bg-green-600 rounded-full" />
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-[9px] font-mono font-bold opacity-30 text-right">
                            VAL: ${space.price}<br/>
                            SELL: ${Math.floor((space.price || 0) / 2)}
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); sellProperty(prop.space_id); }}
                            className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors md:opacity-0 group-hover:opacity-100"
                            title="Sell Property"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {properties.filter(p => p.owner_id === currentPlayer.id).length === 0 && (
                    <div className="py-6 border-2 border-dashed border-black/[0.03] rounded-xl flex items-center justify-center">
                      <span className="text-[9px] uppercase tracking-[0.2em] font-black opacity-10 italic">No properties yet</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* leaderboard */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                 <div className="text-[10px] uppercase tracking-widest font-black opacity-20">Scoreboard</div>
                 <div className="text-[10px] font-black text-blue-600/50">{players.length} PLAYER(S)</div>
              </div>
              <div className="space-y-2 pb-4">
                {players.sort((a, b) => b.balance - a.balance).map((p, idx) => (
                  <div key={p.id} className="flex items-center gap-4 p-3 bg-white border border-black/[0.03] rounded-sm hover:border-black/10 transition-all group">
                    <span className="text-[10px] font-mono opacity-20 font-black">{idx + 1}</span>
                    <div className="w-1 h-6 rounded-full shrink-0" style={{ backgroundColor: p.player_color }} />
                    <div className="flex-1">
                      <div className="text-[10px] font-black text-gray-800 uppercase tracking-tight">{p.name}</div>
                      <div className="text-[9px] font-mono font-bold opacity-30">${p.balance.toLocaleString()}</div>
                    </div>
                    {p.id === currentPlayer?.id && (
                       <span className="text-[7px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Self</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Marquee Footer */}
      <footer className="h-10 bg-white border-t border-black/5 flex items-center px-6 overflow-hidden shrink-0">
        <div className="text-[9px] uppercase tracking-widest text-blue-600 shrink-0 mr-8 font-black flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-ping" />
          Recent Events
        </div>
        <div className="flex items-center space-x-16 text-[10px] opacity-40 animate-marquee whitespace-nowrap font-mono uppercase tracking-tighter">
          {logs.length > 0 ? (
            <>
              {logs.map((log, i) => <span key={`log-${i}`} className="flex items-center gap-2"><span className="text-blue-600 font-black">#</span> {log}</span>)}
              {logs.map((log, i) => <span key={`log-clone-${i}`} className="flex items-center gap-2"><span className="text-blue-600 font-black">#</span> {log}</span>)}
            </>
          ) : (
            <span>Waiting for game events... Buying and selling properties...</span>
          )}
        </div>
      </footer>
    </div>
  );
}

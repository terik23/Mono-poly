/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { BOARD_SPACES } from './constants';
import { motion, AnimatePresence } from 'motion/react';
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
  Timer
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
  const [diceVisual, setDiceVisual] = useState([1, 1]);

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
    const channel = supabase
      .channel(`game-${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` }, (payload) => {
        setPlayers(prev => {
          if (payload.eventType === 'INSERT') {
            const exists = prev.some(p => p.id === payload.new.id);
            if (exists) return prev;
            return [...prev, payload.new as Player];
          }
          if (payload.eventType === 'UPDATE') {
            const updated = prev.map(p => p.id === payload.new.id ? payload.new as Player : p);
            if (currentPlayer && payload.new.id === currentPlayer.id) {
              setCurrentPlayer(payload.new as Player);
            }
            return updated;
          }
          return prev;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties', filter: `game_id=eq.${gameId}` }, (payload) => {
        setProperties(prev => {
          if (payload.eventType === 'INSERT') return [...prev, payload.new as PropertyOwnership];
          if (payload.eventType === 'UPDATE') return prev.map(p => p.space_id === payload.new.space_id ? payload.new as PropertyOwnership : p);
          return prev;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, currentPlayer]);

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

    if (currentPlayer.rolls_remaining <= 0) {
      const nextRecharge = addMinutes(new Date(currentPlayer.last_recharge_at), 30);
      const timeRemaining = formatDistanceToNow(nextRecharge);
      setLogs(prev => [`0 ROLLS REMAINING. RECHARGE IN ${timeRemaining.toUpperCase()}`, ...prev]);
      return;
    }

    setRolling(true);
    
    // Dice animation shuffle
    for(let i = 0; i < 10; i++) {
      setDiceVisual([Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1]);
      await new Promise(r => setTimeout(r, 60));
    }

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    setDiceVisual([d1, d2]);
    const move = d1 + d2;
    
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
        rolls_remaining: currentPlayer.rolls_remaining - 1,
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

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-[#fcfcf9] flex items-center justify-center p-4 font-sans text-gray-900 overflow-hidden">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-10 rounded-sm shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] w-full max-w-md border border-black/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.2)]" />
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center mb-6">
              <Landmark className="text-blue-600 w-10 h-10" />
            </div>
            <h1 className="text-4xl font-serif italic text-black tracking-widest text-center">GLOBAL TYCOON</h1>
            <p className="text-[10px] uppercase tracking-[0.3em] opacity-40 text-center mt-3 font-black">Capital Allocation Protocol</p>
          </div>
          <div className="space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest opacity-40 font-bold ml-1">Identity Signature</label>
              <input type="text" placeholder="OPERATOR NAME" className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-sm text-black placeholder:opacity-30 focus:border-blue-500/50 transition-all outline-none font-mono uppercase text-sm" value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
            </div>
            {errorMsg && (
              <div className="p-4 bg-red-50 text-red-600 border border-red-100 rounded-sm text-[10px] font-mono leading-relaxed">
                <span className="font-bold uppercase block mb-1">Authorization Fault:</span>
                {errorMsg}
              </div>
            )}
            <button onClick={joinGame} disabled={!playerName} className="w-full py-5 bg-black text-white font-black text-sm uppercase tracking-widest rounded-sm shadow-xl hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-30">Initialize Node</button>
          </div>
          <p className="mt-8 text-[9px] text-center opacity-30 uppercase tracking-tight">Connected via Supabase Realtime Flux</p>
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
            <span className="text-[9px] font-bold tracking-widest uppercase opacity-70 font-mono hidden sm:inline">Genesis Node: Active</span>
          </div>
          <div className="h-8 w-[1px] bg-black/5 hidden sm:block"></div>
          <div className="flex flex-col">
            <span className="text-[8px] uppercase tracking-widest opacity-40 font-bold">Reserves</span>
            <span className="text-lg md:text-xl font-mono text-blue-700 font-bold leading-none">${currentPlayer?.balance.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex items-center space-x-4 md:space-x-8 italic font-serif">
          <div className="text-right hidden sm:block">
            <span className="block text-[8px] not-italic uppercase tracking-widest opacity-40 font-bold mb-1">Sector Data</span>
            <span className="text-gray-600 text-sm">{BOARD_SPACES[currentPlayer?.position || 0].name}</span>
          </div>
          <div className="w-[1px] h-8 bg-black/5 hidden sm:block"></div>
          <div className="flex items-center gap-3">
             <div className="flex flex-col text-right">
                <span className="text-[8px] not-italic uppercase tracking-widest opacity-40 font-bold">Operator</span>
                <span className="text-black text-[10px] md:text-xs font-bold font-sans uppercase tracking-tight">{currentPlayer?.name}</span>
             </div>
             <div className="w-9 h-9 md:w-10 md:h-10 rounded-sm border border-black/5 flex items-center justify-center text-xs font-mono shadow-sm" style={{ backgroundColor: currentPlayer?.player_color + '22', color: currentPlayer?.player_color }}>
                {currentPlayer?.name.charAt(0)}
             </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Game Area */}
        <div className="flex-1 flex items-center justify-center p-2 md:p-4 bg-gray-50/50 overflow-auto relative">
          <div className="relative aspect-square w-full max-w-[800px] bg-white border border-black/[0.05] rounded-sm shadow-[0_20px_50px_rgba(0,0,0,0.05)] ring-1 ring-black/[0.02]">
            <div className="grid grid-cols-11 grid-rows-11 h-full w-full">
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
                      <span className="text-[7px] md:text-[8px] font-black uppercase tracking-tighter text-gray-800 leading-tight">
                        {space.name}
                      </span>
                      {space.price && <span className="text-[6px] md:text-[8px] font-mono opacity-30 mt-auto">${space.price}</span>}
                    </div>

                    {ownership && ownership.buildings > 0 && (
                      <div className="absolute top-1 right-1 flex gap-0.5 bg-white/80 rounded-[1px] p-0.5 border border-black/5 shadow-sm">
                        {Array.from({ length: ownership.buildings }).map((_, i) => <Building2 key={i} className={cn("w-1.5 h-1.5 md:w-2 md:h-2", i === 4 ? "text-red-500" : "text-blue-600")} />)}
                      </div>
                    )}

                    {owner && (
                      <div className="absolute bottom-0 left-0 w-full h-0.5 md:h-1" style={{ backgroundColor: owner.player_color }} />
                    )}

                    {/* Player Avatars */}
                    <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-0.5 z-20 pointer-events-none">
                      {players.filter(p => p.position === space.id).map(p => (
                        <motion.div 
                          key={p.id} 
                          layoutId={`p-${p.id}`} 
                          className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 rounded-full ring-1 ring-white shadow-lg" 
                          style={{ backgroundColor: p.player_color }} 
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Center Dashboard */}
              <div className="col-start-2 col-end-11 row-start-2 row-end-11 flex flex-col items-center justify-center p-4">
                <div className="text-center mb-8 md:mb-12">
                   <h1 className="text-[4vw] lg:text-[4.5rem] font-serif italic text-black/[0.03] tracking-[0.2em] leading-none mb-1 md:mb-4 select-none">TYCOON GLOBAL</h1>
                   <p className="text-[8px] md:text-[10px] uppercase tracking-[0.5em] opacity-40 font-black italic">Macro-Asset Exchange</p>
                </div>

                {currentPlayer && (
                  <div className="relative">
                    <div className="relative bg-white/80 backdrop-blur-sm border border-black/5 p-6 md:p-12 rounded-[1px] flex flex-col items-center min-w-[200px] md:min-w-[320px] shadow-2xl shadow-black/5">
                      <div className="text-[8px] md:text-[10px] uppercase tracking-[0.3em] font-black opacity-20 mb-4 md:mb-8">Pulse Generation</div>
                      
                      <div className="flex gap-4 mb-4 md:mb-8">
                         {[0, 1].map(idx => (
                           <motion.div 
                            key={idx}
                            animate={rolling ? { rotate: [0, 90, -90, 0], scale: [1, 1.2, 0.8, 1] } : {}}
                            className="w-12 h-12 md:w-20 md:h-20 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center shadow-inner"
                           >
                              <span className="text-2xl md:text-5xl font-mono text-black font-black">{diceVisual[idx]}</span>
                           </motion.div>
                         ))}
                      </div>

                      <button 
                        onClick={rollDice} 
                        disabled={rolling || currentPlayer.rolls_remaining <= 0} 
                        className="px-8 md:px-14 py-3 md:py-5 bg-black text-white font-black uppercase tracking-[0.2em] text-[10px] md:text-xs hover:bg-blue-600 transition-all disabled:opacity-10 disabled:cursor-not-allowed rounded-[1px] w-full shadow-lg"
                      >
                        {rolling ? "PROCESSING..." : "EXECUTE MOVE"}
                      </button>

                      <div className="mt-4 md:mt-6 flex flex-col items-center gap-1">
                        <div className="flex gap-1.5">
                          {[...Array(5)].map((_, i) => (
                            <div key={i} className={cn("w-2 h-2 rounded-full", i < currentPlayer.rolls_remaining ? "bg-blue-600" : "bg-gray-200")} />
                          ))}
                        </div>
                        <span className="text-[8px] font-black opacity-30 uppercase tracking-widest">{currentPlayer.rolls_remaining} CHARGES AVAILABLE</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Controls */}
        <aside className="w-full md:w-[320px] lg:w-[400px] bg-white border-t md:border-t-0 md:border-l border-black/5 flex flex-col shadow-2xl p-4 md:p-10 shrink-0 overflow-hidden">
          <div className="flex-1 flex flex-col gap-8 md:gap-12 overflow-y-auto custom-scrollbar">
            {/* Reserves & Context */}
            <div className="space-y-6">
               <div className="flex justify-between items-end border-b border-black/5 pb-2">
                 <span className="text-[10px] uppercase tracking-widest font-black opacity-20">Sector Context</span>
                 <span className="text-xs font-serif italic text-gray-600">{BOARD_SPACES[currentPlayer?.position || 0].name} ({BOARD_SPACES[currentPlayer?.position || 0].type})</span>
               </div>
               
               <div className="bg-gray-50/80 border border-black/[0.03] p-6 rounded-[1px] relative">
                 <div className="flex flex-col gap-1">
                   <span className="text-[8px] uppercase tracking-widest opacity-40 font-black">Capital Liquidity</span>
                   <span className="text-4xl font-mono text-black font-black tracking-tight">${currentPlayer?.balance.toLocaleString()}</span>
                 </div>
                 <div className="mt-4 flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-[9px] uppercase font-black opacity-30 tracking-widest">
                       <span>Dividend Progress</span>
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
              <div className="space-y-4">
                <div className="text-[10px] uppercase tracking-widest font-black opacity-20">Asset Acquisition</div>
                <div className="space-y-3">
                  {!properties.find(p => p.space_id === currentPlayer.position) ? (
                    <button 
                      onClick={() => buyProperty(currentPlayer.position)} 
                      disabled={currentPlayer.balance < (BOARD_SPACES[currentPlayer.position].price || 0)} 
                      className="w-full py-4 bg-white border border-black/10 text-black font-black uppercase text-xs tracking-widest hover:border-blue-600 hover:text-blue-600 transition-all disabled:opacity-20 rounded-[1px] shadow-sm flex items-center justify-center gap-2"
                    >
                      SECURE ASSET · ${BOARD_SPACES[currentPlayer.position].price}
                    </button>
                  ) : properties.find(p => p.space_id === currentPlayer.position)?.owner_id === currentPlayer.id ? (
                    <button 
                      onClick={() => buildHouse(currentPlayer.position)} 
                      disabled={currentPlayer.balance < Math.floor((BOARD_SPACES[currentPlayer.position].price || 100) * 0.5) || (properties.find(p => p.space_id === currentPlayer.position)?.buildings || 0) >= 5} 
                      className="w-full py-4 bg-blue-600 text-white font-black uppercase text-xs tracking-widest hover:bg-black transition-all disabled:opacity-20 rounded-[1px] shadow-lg flex items-center justify-center gap-2"
                    >
                      <Building2 className="w-4 h-4" /> UPGRADE INFRASTRUCTURE
                    </button>
                  ) : (
                    <div className="p-4 bg-gray-50 border border-black/5 text-center text-[10px] uppercase tracking-widest opacity-20 font-black italic">
                      Asset Managed by External Entity
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* leaderboard */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                 <div className="text-[10px] uppercase tracking-widest font-black opacity-20">Consolidated Rankings</div>
                 <div className="text-[10px] font-black text-blue-600/50">{players.length} NODE(S)</div>
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
          Global Feed
        </div>
        <div className="flex items-center space-x-16 text-[10px] opacity-40 animate-marquee whitespace-nowrap font-mono uppercase tracking-tighter">
          {logs.length > 0 ? (
            <>
              {logs.map((log, i) => <span key={`log-${i}`} className="flex items-center gap-2"><span className="text-blue-600 font-black">#</span> {log}</span>)}
              {logs.map((log, i) => <span key={`log-clone-${i}`} className="flex items-center gap-2"><span className="text-blue-600 font-black">#</span> {log}</span>)}
            </>
          ) : (
            <span>Synchronizing worldview... Preparing strategic vectors... Calibrating market indices...</span>
          )}
        </div>
      </footer>
    </div>
  );
}

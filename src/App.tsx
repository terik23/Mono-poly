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
}

interface PropertyOwnership {
  space_id: number;
  owner_id: string | null;
  buildings: number;
}

const PLAYER_COLORS = [
  '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'
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
      setErrorMsg(`Data Error: ${e.message || 'Check if "players" and "properties" tables exist.'}`);
    }
  }, []);

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
          if (payload.eventType === 'INSERT') return [...prev, payload.new as Player];
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
        last_daily_at: new Date().toISOString()
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

    if (currentPlayer.last_roll_at) {
      const nextRoll = addMinutes(new Date(currentPlayer.last_roll_at), 30);
      if (isAfter(nextRoll, new Date())) {
        const timeRemaining = formatDistanceToNow(nextRoll);
        setLogs(prev => [`Wait ${timeRemaining} to roll!`, ...prev]);
        return;
      }
    }

    setRolling(true);
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const move = d1 + d2;
    
    let nextPos = (currentPlayer.position + move) % 40;
    let balance = currentPlayer.balance;

    const lastDaily = new Date(currentPlayer.last_daily_at);
    if (new Date().getTime() - lastDaily.getTime() > 24 * 60 * 60 * 1000) {
      balance += 100;
      setLogs(prev => [`Daily $100 bonus collected!`, ...prev]);
    }

    if (nextPos < currentPlayer.position) {
      balance += 200;
      setLogs(prev => [`Passed GO! Collected $200`, ...prev]);
    }

    const space = BOARD_SPACES[nextPos];
    setLogs(prev => [`Rolled ${move}! Landed on ${space.name}`, ...prev]);

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
        setLogs(prev => [`Paid $${rent} rent to ${owner.name}`, ...prev]);
      }
    }

    await supabase
      .from('players')
      .update({ 
        position: nextPos, 
        balance: balance,
        last_roll_at: new Date().toISOString(),
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
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-4 font-sans text-[#e0e0e0]">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#0f0f12] p-10 rounded-sm shadow-2xl w-full max-w-md border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mb-6">
              <Landmark className="text-emerald-400 w-10 h-10" />
            </div>
            <h1 className="text-4xl font-serif italic text-white tracking-widest text-center">GLOBAL TYCOON</h1>
            <p className="text-xs uppercase tracking-[0.3em] opacity-40 text-center mt-3 font-bold">Persistent Real-Estate Protocol</p>
          </div>
          <div className="space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest opacity-40 font-bold ml-1">Identity</label>
              <input type="text" placeholder="OPERATOR NAME" className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-sm text-white placeholder:opacity-20 focus:border-emerald-500/50 transition-all outline-none font-mono uppercase text-sm" value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
            </div>
            {errorMsg && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-sm text-red-400 text-[10px] font-mono leading-relaxed">
                <span className="font-bold uppercase block mb-1">Fatal Exception:</span>
                {errorMsg}
              </div>
            )}
            <button onClick={joinGame} disabled={!playerName} className="w-full py-5 bg-[#e0e0e0] text-[#0a0a0b] font-black text-sm uppercase tracking-widest rounded-sm shadow-xl hover:bg-white transition-all active:scale-95 disabled:opacity-30">Initialize Interface</button>
          </div>
          <p className="mt-8 text-[9px] text-center opacity-30 uppercase tracking-tighter">Connected to Supabase Realtime Gateway</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0a0a0b] text-[#e0e0e0] font-sans flex flex-col overflow-hidden select-none">
      {/* Top Header */}
      <header className="h-16 border-b border-white/10 bg-[#0f0f12] px-8 flex items-center justify-between shadow-2xl z-20 shrink-0">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            <span className="text-[10px] font-bold tracking-widest uppercase opacity-70 font-mono">Server Status: Online / {gameId.toUpperCase()}</span>
          </div>
          <div className="h-8 w-[1px] bg-white/10"></div>
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-widest opacity-40 font-bold">Liquid Balance</span>
            <span className="text-xl font-mono text-emerald-400 font-bold leading-none">${currentPlayer?.balance.toLocaleString()}.00</span>
          </div>
        </div>
        <div className="flex items-center space-x-8 italic font-serif">
          <div className="text-right">
            <span className="block text-[9px] not-italic uppercase tracking-widest opacity-40 font-bold mb-1">Location Context</span>
            <span className="text-amber-200 text-sm">{BOARD_SPACES[currentPlayer?.position || 0].name}</span>
          </div>
          <div className="w-[1px] h-8 bg-white/10"></div>
          <div className="flex items-center gap-3">
             <div className="hidden sm:flex flex-col text-right">
                <span className="text-[9px] not-italic uppercase tracking-widest opacity-40 font-bold">Identity</span>
                <span className="text-white text-xs">{currentPlayer?.name}</span>
             </div>
             <div className="w-10 h-10 rounded-sm border border-white/20 flex items-center justify-center text-xs font-mono" style={{ backgroundColor: currentPlayer?.player_color + '44' }}>
                {currentPlayer?.name.charAt(0)}
             </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Game Area */}
        <div className="flex-1 flex items-center justify-center p-4 bg-radial-[circle_at_center,_var(--tw-gradient-stops)] from-[#1a1b21] to-[#0a0a0b] overflow-auto">
          <div className="relative aspect-square w-full max-w-[800px] bg-[#0a0a0c] border-[8px] border-[#16161a] rounded-sm shadow-[0_0_50px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
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
                const isVertical = (space.id > 10 && space.id < 20) || space.id > 30;

                return (
                  <div key={space.id} style={{ gridArea }} className={cn(
                    "border-[0.5px] border-white/10 relative flex flex-col items-center bg-[#16161a] transition-colors overflow-hidden",
                    isCorner && "bg-[#1f1f25]"
                  )}>
                    {space.color && (
                      <div className={cn(
                        "absolute w-full h-[18%]", 
                        space.id < 10 && "top-0", 
                        space.id > 10 && space.id < 20 && "right-0 h-full w-[18%]", 
                        space.id > 20 && space.id < 30 && "bottom-0", 
                        space.id > 30 && "left-0 h-full w-[18%]"
                      )} style={{ backgroundColor: space.color + 'cc' }} />
                    )}
                    
                    <div className={cn(
                      "z-10 p-1 flex flex-col items-center justify-center h-full w-full text-center",
                      isVertical && "rotate-0" // In a real monopoly UI we'd rotate, keeping simple for now
                    )}>
                      <span className="text-[10px] font-bold uppercase tracking-tighter opacity-80 leading-tight">
                        {space.name}
                      </span>
                      {space.price && <span className="text-[9px] font-mono opacity-40 mt-auto">${space.price}</span>}
                    </div>

                    {ownership && ownership.buildings > 0 && (
                      <div className="absolute top-1 right-1 flex gap-0.5 bg-black/40 rounded px-0.5 border border-white/5">
                        {Array.from({ length: ownership.buildings }).map((_, i) => <Building2 key={i} className={cn("w-1.5 h-1.5", i === 4 ? "text-red-500" : "text-emerald-400")} />)}
                      </div>
                    )}

                    {owner && (
                      <div className="absolute bottom-0 left-0 w-full h-0.5" style={{ backgroundColor: owner.player_color }} />
                    )}

                    {/* Player Avatars */}
                    <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-0.5 z-20 pointer-events-none">
                      {players.filter(p => p.position === space.id).map(p => (
                        <motion.div 
                          key={p.id} 
                          layoutId={`p-${p.id}`} 
                          className="w-3 h-3 rounded-sm ring-1 ring-white/50 shadow-[0_0_8px_rgba(0,0,0,0.5)]" 
                          style={{ backgroundColor: p.player_color }} 
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Center Dashboard */}
              <div className="col-start-2 col-end-11 row-start-2 row-end-11 flex flex-col items-center justify-center p-8 bg-transparent">
                <div className="text-center mb-12">
                   <h1 className="text-[5vw] lg:text-[4rem] font-serif italic text-white/5 tracking-[0.2em] leading-none mb-2">WORLD ORDER</h1>
                   <p className="text-[10px] uppercase tracking-[0.5em] opacity-10 italic">Persistent Multiplayer Real-Estate Interface</p>
                </div>

                {currentPlayer && (
                  <div className="relative group">
                    <div className="absolute -inset-4 bg-emerald-500/10 blur-2xl opacity-0 group-hover:opacity-100 transition-all duration-1000" />
                    <div className="relative bg-[#0f0f12] border border-white/10 p-12 rounded-sm flex flex-col items-center min-w-[280px]">
                      <div className="text-[10px] uppercase tracking-[0.3em] font-black opacity-30 mb-6">Strategic Roll</div>
                      
                      {rolling ? (
                         <Dice5 className="w-20 h-20 text-white animate-spin mb-8" />
                      ) : (
                        <div className="text-6xl font-mono text-white mb-8 tracking-tighter">
                          {currentPlayer.last_roll_at && isAfter(addMinutes(new Date(currentPlayer.last_roll_at), 30), new Date()) ? (
                            <span className="text-3xl opacity-50">{formatDistanceToNow(addMinutes(new Date(currentPlayer.last_roll_at), 30))}</span>
                          ) : (
                            <Dice5 className="w-20 h-20 text-white" />
                          )}
                        </div>
                      )}

                      <button 
                        onClick={rollDice} 
                        disabled={rolling || (currentPlayer.last_roll_at && isAfter(addMinutes(new Date(currentPlayer.last_roll_at), 30), new Date()))} 
                        className="px-12 py-4 bg-white text-black font-black uppercase tracking-widest text-xs hover:bg-emerald-400 transition-all disabled:opacity-10 disabled:cursor-not-allowed rounded-sm w-full"
                      >
                        Roll Execution
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Controls */}
        <aside className="w-full lg:w-[380px] bg-[#0f0f12] border-l border-white/10 flex flex-col shadow-2xl p-6 lg:p-10 shrink-0">
          <div className="space-y-10 flex-1 flex flex-col">
            {/* Identity/Balance Info */}
            <div className="space-y-6">
               <div className="flex justify-between items-end border-b border-white/5 pb-2">
                 <span className="text-[10px] uppercase tracking-[0.2em] font-black opacity-30">Active Protocol</span>
                 <span className="text-sm font-serif italic text-white">Global-Supabase-01</span>
               </div>
               
               <div className="bg-white/5 border border-white/10 p-6 rounded-sm relative overflow-hidden">
                 <div className="flex flex-col gap-1">
                   <span className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Total Net Worth</span>
                   <span className="text-3xl font-mono text-white font-black">${currentPlayer?.balance.toLocaleString()}</span>
                 </div>
                 <div className="mt-6 flex flex-col gap-2">
                    <span className="text-[10px] uppercase opacity-40 italic tracking-widest">Dividend Status</span>
                    <span className="text-amber-200/80 text-xs italic font-serif">+$100 Scheduled (Daily Cycle)</span>
                 </div>
               </div>
            </div>

            {/* Interaction Area */}
            <div className="space-y-4">
              <div className="text-[10px] uppercase tracking-[0.2em] font-black opacity-30 mb-2">Location Actions</div>
              {currentPlayer && BOARD_SPACES[currentPlayer.position].type === 'property' && (
                <div className="space-y-3">
                  <div className="p-4 bg-white/3 border border-white/10 rounded-sm">
                    <div className="flex justify-between text-[11px] mb-1">
                       <span className="opacity-40 uppercase">Target Location</span>
                       <span className="font-bold">{BOARD_SPACES[currentPlayer.position].name}</span>
                    </div>
                  </div>
                  
                  {!properties.find(p => p.space_id === currentPlayer.position) ? (
                    <button 
                      onClick={() => buyProperty(currentPlayer.position)} 
                      disabled={currentPlayer.balance < (BOARD_SPACES[currentPlayer.position].price || 0)} 
                      className="w-full py-4 bg-white text-black font-black uppercase text-xs tracking-[0.2em] hover:bg-emerald-400 transition-all disabled:opacity-20 rounded-sm"
                    >
                      Acquire Asset (${BOARD_SPACES[currentPlayer.position].price})
                    </button>
                  ) : properties.find(p => p.space_id === currentPlayer.position)?.owner_id === currentPlayer.id ? (
                    <button 
                      onClick={() => buildHouse(currentPlayer.position)} 
                      disabled={currentPlayer.balance < Math.floor((BOARD_SPACES[currentPlayer.position].price || 100) * 0.5) || (properties.find(p => p.space_id === currentPlayer.position)?.buildings || 0) >= 5} 
                      className="w-full py-4 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 font-black uppercase text-xs tracking-[0.2em] transition-all disabled:opacity-20 rounded-sm"
                    >
                      Infrastructure Upgrade (${Math.floor((BOARD_SPACES[currentPlayer.position].price || 100) * 0.5)})
                    </button>
                  ) : (
                    <div className="py-4 text-center border border-white/5 text-[10px] uppercase tracking-widest opacity-20 italic">
                      Asset Owned by Competitor
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Players List */}
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="text-[10px] uppercase tracking-[0.2em] font-black opacity-30 mb-4">Network Participants ({players.length})</div>
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                {players.sort((a, b) => b.balance - a.balance).map(player => (
                  <div key={player.id} className="flex items-center gap-3 p-2 bg-white/2 rounded-sm border border-transparent hover:border-white/5">
                    <div className="w-2 h-8 rounded-full" style={{ backgroundColor: player.player_color }} />
                    <div className="flex-1">
                      <div className="text-[11px] font-bold text-white uppercase">{player.name}</div>
                      <div className="text-[9px] font-mono opacity-40">${player.balance.toLocaleString()}</div>
                    </div>
                    {player.id === currentPlayer?.id && <div className="text-[8px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded-full border border-emerald-500/20 font-black uppercase">YOU</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Footer Log Marquee */}
      <footer className="h-10 bg-[#0f0f12] border-t border-white/10 flex items-center px-6 overflow-hidden shrink-0">
        <div className="text-[9px] uppercase tracking-widest text-emerald-500 shrink-0 mr-6 font-black flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          Live Vector Logs:
        </div>
        <div className="flex items-center space-x-12 text-[10px] opacity-50 animate-marquee whitespace-nowrap font-mono uppercase tracking-tighter">
          {logs.length > 0 ? (
            <>
              {logs.map((log, i) => <span key={i}>{log}</span>)}
              {logs.map((log, i) => <span key={i + '-clone'}>{log}</span>)}
            </>
          ) : (
            <>
              <span>Awaiting world vector data...</span>
              <span>Initializing secure protocol connection...</span>
              <span>Connecting to gateway genetic sequences...</span>
              <span>Awaiting world vector data...</span>
              <span>Initializing secure protocol connection...</span>
              <span>Connecting to gateway genetic sequences...</span>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

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
  Dices,
  Dice1,
  Dice2,
  Dice3,
  Dice4,
  Dice5,
  Dice6,
  History, 
  Users, 
  Send,
  Home,
  Landmark,
  Timer,
  Plane,
  Menu,
  X,
  TrendingUp,
  TrendingDown,
  Briefcase,
  Coins,
  ArrowRightLeft,
  Skull,
  Bell
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, addMinutes, isAfter } from 'date-fns';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Stock {
  symbol: string;
  name: string;
  price: number;
  history: { time: string; price: number }[];
  change: number;
}

interface Player {
  id: string;
  game_id: string;
  name: string;
  password?: string;
  balance: number;
  position: number;
  last_roll_at: string | null;
  last_daily_at: string;
  player_color: string;
  is_bankrupt?: boolean;
  debt_started_at?: string | null;
}

interface PropertyOwnership {
  space_id: number;
  game_id: string;
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
  const [playerName, setPlayerName] = useState('');
  const [password, setPassword] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [rolling, setRolling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [diceVisual, setDiceVisual] = useState([1]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [view, setView] = useState<'board' | 'stocks' | 'transfer' | 'stats'>('board');
  const [zoom, setZoom] = useState(0.4);
  const [isFollowing, setIsFollowing] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  
  // Auto-follow logic
  useEffect(() => {
    if (isFollowing && currentPlayer && scrollContainerRef.current) {
      const space = document.getElementById(`space-${currentPlayer.position}`);
      if (space) {
        const container = scrollContainerRef.current;
        
        // Ensure we are zoomed in for detail
        if (zoom < 1.4) {
          setZoom(1.5);
          return;
        }

        const spaceRect = space.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Robust centering using bounding rects to handle scaling/transforms correctly
        const scrollX = container.scrollLeft + (spaceRect.left + spaceRect.width / 2) - (containerRect.left + containerRect.width / 2);
        const scrollY = container.scrollTop + (spaceRect.top + spaceRect.height / 2) - (containerRect.top + containerRect.height / 2);
        
        container.scrollTo({
          left: scrollX,
          top: scrollY,
          behavior: 'smooth'
        });
      }
    }
  }, [isFollowing, currentPlayer?.position, currentPlayer, zoom]);

  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'info' | 'error' | 'success' }[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([
    { symbol: 'AMZN', name: 'Anazona', price: 150, history: [], change: 0 },
    { symbol: 'WDWS', name: 'Windidows', price: 280, history: [], change: 0 },
    { symbol: 'META', name: 'Metas', price: 310, history: [], change: 0 },
    { symbol: 'EBAY', name: 'Ebais', price: 45, history: [], change: 0 },
    { symbol: 'PEAR', name: 'Pear', price: 190, history: [], change: 0 },
  ]);
  const [playerStocks, setPlayerStocks] = useState<Record<string, number>>({}); // symbol -> amount
  const [isBotThinking, setIsBotThinking] = useState(false);

  const addToast = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

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

  useEffect(() => {
    // Analytics Sync and Health check
    if (view === 'stats') {
       fetchData(gameId);
    }
  }, [view, gameId, fetchData]);


  // Zoom to fit or manual zoom?
  useEffect(() => {
    const handleResize = () => {
      if (!isFollowing) {
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        const size = Math.min(vw * 0.8, vh * 0.8);
        setZoom(size / 2000);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isFollowing]);

  // One-time reset script
  useEffect(() => {
    const resetPlayers = async () => {
      const hasReset = localStorage.getItem('tycoon_v17_reset');
      if (!hasReset) {
        // Delete everything to enforce password accounts
        const { error: pErr } = await supabase.from('properties').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        const { error: uErr } = await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        if (!pErr && !uErr) {
          localStorage.setItem('tycoon_v17_reset', 'true');
          window.location.reload();
        }
      }
    };
    resetPlayers(); 
  }, []);

  // Stock Market Fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      setStocks(prev => prev.map(s => {
        // High volatility with occasional extreme swings (Insane dips/ups)
        const isExtreme = Math.random() < 0.15; 
        const volatility = isExtreme ? 0.6 : 0.08;
        const direction = Math.random() < 0.5 ? -1 : 1;
        const change = direction * Math.random() * volatility;
        
        const newPrice = Math.max(0.1, s.price * (1 + change));
        const newHistory = [...s.history.slice(-19), { time: new Date().toLocaleTimeString(), price: newPrice }];
        return { 
          ...s, 
          price: Number(newPrice.toFixed(2)), 
          history: newHistory,
          change: Number((change * 100).toFixed(2))
        };
      }));

      // Debt Reset System (1 Hour Check)
      setPlayers(prev => {
        prev.forEach(async (p) => {
          if (p.balance < 0) {
            if (!p.debt_started_at) {
              await supabase.from('players').update({ debt_started_at: new Date().toISOString() }).eq('id', p.id);
            } else {
              const debtHours = (new Date().getTime() - new Date(p.debt_started_at).getTime()) / (1000 * 60 * 60);
              if (debtHours >= 1) {
                addToast(`${p.name} reset due to overdue debt`, "error");
                await supabase.from('players').update({ balance: 1500, position: 0, debt_started_at: null, is_bankrupt: false }).eq('id', p.id);
              }
            }
          } else if (p.debt_started_at) {
            await supabase.from('players').update({ debt_started_at: null }).eq('id', p.id);
          }
        });
        return prev;
      });
    }, 30000); // 30 seconds per update for slower market
    return () => clearInterval(interval);
  }, []);

  const buyStock = (symbol: string, amount: number) => {
    const stock = stocks.find(s => s.symbol === symbol);
    if (!stock || !currentPlayer) return;
    const cost = stock.price * amount;
    if (currentPlayer.balance < cost) {
      addToast("Insufficient funds for stocks", "error");
      return;
    }

    setPlayerStocks(prev => ({
      ...prev,
      [symbol]: (prev[symbol] || 0) + amount
    }));

    handleBalanceUpdate(currentPlayer.id, -cost);
    addToast(`Purchased ${amount} shares of ${stock.name}`, "success");
  };

  const sellStock = (symbol: string, amount: number) => {
    const stock = stocks.find(s => s.symbol === symbol);
    const owned = playerStocks[symbol] || 0;
    if (!stock || !currentPlayer || owned < amount) return;

    const profit = stock.price * amount;
    setPlayerStocks(prev => ({
      ...prev,
      [symbol]: owned - amount
    }));

    handleBalanceUpdate(currentPlayer.id, profit);
    addToast(`Sold ${amount} shares of ${stock.name} for $${profit.toFixed(2)}`, "success");
  };

  const handleBalanceUpdate = async (playerId: string, delta: number) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    
    const newBalance = player.balance + delta;
    
    // Bankruptcy check
    if (newBalance < -500) {
      addToast(`${player.name} DECLARED BANKRUPT!`, "error");
      await supabase.from('players').update({ balance: 1500, position: 0, is_bankrupt: false }).eq('id', playerId);
      return;
    }

    await supabase.from('players').update({ balance: newBalance }).eq('id', playerId);
  };

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
    
    // Fetch initial data
    fetchData(gameId);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(syncInterval);
    };
  }, [gameId, fetchData]);

  const joinGame = async () => {
    if (!playerName || !password) {
      addToast("Name and Password required", "error");
      return;
    }
    setErrorMsg(null);

    try {
      const { data: existingPlayer, error: checkError } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', gameId)
        .eq('name', playerName)
        .maybeSingle();

      if (checkError) throw checkError;

      if (authMode === 'signup') {
        if (existingPlayer) {
          addToast("Operating Name already registered", "error");
          return;
        }
      } else {
        // Login mode
        if (!existingPlayer) {
          addToast("Operator not found. Please Sign Up.", "error");
          return;
        }
        if (existingPlayer.password && existingPlayer.password !== password) {
          addToast("Invalid Security Key", "error");
          return;
        }
        
        setCurrentPlayer({ ...existingPlayer, password });
        setIsJoined(true);
        fetchData(gameId);
        return;
      }

      // Create new player for Sign Up
      const newPlayer = {
        game_id: gameId,
        name: playerName,
        password: password,
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
        addToast("Welcome to Tycoon", "success");
      }
    } catch (e: any) {
      console.error("Join Game Error:", e);
      setErrorMsg(`Join Failed: ${e.message}`);
    }
  };

  const rollDice = async () => {
    if (!currentPlayer || rolling) return;

    setRolling(true);
    
    // Dice animation shuffle
    for(let i = 0; i < 10; i++) {
      setDiceVisual([Math.floor(Math.random() * 6) + 1]);
      await new Promise(r => setTimeout(r, 60));
    }

    const d1 = Math.floor(Math.random() * 6) + 1;
    setDiceVisual([d1]);
    const move = d1;
    
    let nextPos = (currentPlayer.position + move) % 200;
    let balance = currentPlayer.balance;

    const lastDaily = new Date(currentPlayer.last_daily_at);
    if (new Date().getTime() - lastDaily.getTime() > 24 * 60 * 60 * 1000) {
      balance += 100;
      addToast("Daily dividend $100 collected", "success");
    }

    if (nextPos < currentPlayer.position) {
      balance += 200;
      addToast("Passed GO! +$200", "success");
      
      // Tax for big companies
      const myProps = properties.filter(p => p.owner_id === currentPlayer.id).length;
      if (myProps > 10) {
        const tax = myProps * 15;
        balance -= tax;
        addToast(`Conglomerate Tax: -$${tax}`, "error");
      }
    }

    const space = BOARD_SPACES[nextPos];
    setLogs(prev => [`ROLLED ${move}! ARRIVED AT ${space.name.toUpperCase()}`, ...prev]);

    // Optimistic Local Update for instant movement
    const updatedPlayer = { 
      ...currentPlayer, 
      position: nextPos, 
      balance: balance,
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

  const transferMoney = async (toPlayerId: string, amount: number) => {
    if (!currentPlayer || amount <= 0 || currentPlayer.balance < amount) {
      addToast("Invalid transfer request", "error");
      return;
    }

    const { error: senderErr } = await supabase.from('players').update({ balance: currentPlayer.balance - amount }).eq('id', currentPlayer.id);
    const target = players.find(p => p.id === toPlayerId);
    if (target) {
      await supabase.from('players').update({ balance: target.balance + amount }).eq('id', toPlayerId);
    }

    if (!senderErr) {
      addToast(`Transferred $${amount} to ${target?.name}`, "success");
      setLogs(prev => [`TRANSFERRED $${amount} TO ${target?.name.toUpperCase()}`, ...prev]);
    }
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
          <div className="flex bg-gray-100 p-1 rounded-2xl mb-8">
            <button 
              onClick={() => setAuthMode('login')}
              className={cn(
                "flex-1 py-3 text-[10px] uppercase tracking-widest font-black rounded-xl transition-all",
                authMode === 'login' ? "bg-white text-black shadow-sm" : "text-gray-400"
              )}
            >
              Log In
            </button>
            <button 
              onClick={() => setAuthMode('signup')}
              className={cn(
                "flex-1 py-3 text-[10px] uppercase tracking-widest font-black rounded-xl transition-all",
                authMode === 'signup' ? "bg-white text-black shadow-sm" : "text-gray-400"
              )}
            >
              Sign Up
            </button>
          </div>

          <div className="space-y-8">
            {authMode === 'login' && players.length > 0 && players.filter(p => !p.name.startsWith('[BOT]')).length > 0 && (
              <div className="space-y-3">
                <label className="text-[10px] uppercase tracking-widest opacity-30 font-black ml-1">Recent Operators</label>
                <div className="grid grid-cols-1 gap-2">
                  {players.filter(p => !p.name.startsWith('[BOT]')).slice(0, 3).map(p => (
                    <button 
                      key={p.id}
                      onClick={() => {
                        setPlayerName(p.name);
                        // Don't auto-join here, force password check
                      }}
                      className={cn(
                        "flex items-center justify-between p-4 border rounded-2xl transition-all group",
                        playerName === p.name ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-black/[0.03] hover:border-blue-100"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-mono" style={{ backgroundColor: p.player_color + '22', color: p.player_color }}>
                          {p.name.charAt(0)}
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-tight text-gray-700">{p.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-widest opacity-40 font-black ml-1 text-blue-600">
                  {authMode === 'login' ? 'Operator Name' : 'New Identity'}
                </label>
                <input type="text" placeholder="ENTER NAME" className="w-full px-8 py-5 bg-gray-50 border border-gray-200 rounded-2xl text-black placeholder:opacity-30 focus:border-blue-500/50 transition-all outline-none font-mono uppercase text-sm shadow-inner" value={playerName} onChange={(e) => setPlayerName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-widest opacity-40 font-black ml-1 text-blue-600">Access Key</label>
                <input type="password" placeholder="PASSWORD" className="w-full px-8 py-5 bg-gray-50 border border-gray-200 rounded-2xl text-black placeholder:opacity-30 focus:border-blue-500/50 transition-all outline-none font-mono uppercase text-sm shadow-inner" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>
            {errorMsg && (
              <div className="p-5 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[10px] font-mono leading-relaxed">
                <span className="font-bold uppercase block mb-1">Error:</span>
                {errorMsg}
              </div>
            )}
            <button onClick={joinGame} disabled={!playerName || !password} className="w-full py-6 bg-black text-white font-black uppercase tracking-[0.3em] text-sm rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] hover:bg-zinc-800 transition-all active:scale-95 disabled:opacity-30">
              {authMode === 'login' ? 'Authenticate' : 'Register Operator'}
            </button>
          </div>
          <p className="mt-10 text-[10px] text-center opacity-30 uppercase tracking-[0.2em] font-black">Syncing: Online</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#fcfcf9] text-gray-900 font-sans flex flex-col overflow-hidden select-none">
      {/* Toasts (Apple Style) */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-[400px] px-4 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div 
              key={t.id}
              initial={{ y: -100, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.95 }}
              className="bg-white/80 backdrop-blur-2xl border border-black/[0.08] px-5 py-4 rounded-[1.5rem] shadow-[0_20px_40px_rgba(0,0,0,0.1)] flex items-center gap-4 pointer-events-auto"
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                t.type === 'success' && "bg-green-100 text-green-600",
                t.type === 'error' && "bg-red-100 text-red-600",
                t.type === 'info' && "bg-blue-100 text-blue-600"
              )}>
                {t.type === 'success' && <TrendingUp className="w-5 h-5" />}
                {t.type === 'error' && <TrendingDown className="w-5 h-5" />}
                {t.type === 'info' && <Bell className="w-5 h-5" />}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-30 leading-none mb-1">
                  {t.type === 'error' ? 'Warning' : 'System'}
                </span>
                <span className="text-[13px] font-semibold text-gray-800 leading-tight">{t.message}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

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
        {/* Global Stats HUD (Top) */}
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] pointer-events-none flex items-center gap-4">
             {currentPlayer && (
                <div className="bg-white/95 backdrop-blur-3xl border border-black/[0.1] shadow-[0_40px_100px_rgba(0,0,0,0.1)] px-12 py-6 rounded-full flex items-center gap-16 pointer-events-auto">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-[.4em] font-black opacity-30 mb-2">CASH ON HAND</span>
                      <span className="text-3xl font-mono font-black text-green-600">${currentPlayer.balance.toLocaleString()}</span>
                    </div>
                    <div className="w-px h-12 bg-black/10" />
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-[.4em] font-black opacity-30 mb-2">TOTAL NET WORTH</span>
                      <span className="text-3xl font-mono font-black text-blue-600">${(currentPlayer.balance + Object.entries(playerStocks).reduce((acc, [s, a]) => {
                        const stock = stocks.find(st => st.symbol === s);
                        return acc + (stock?.price || 0) * (a as number);
                      }, 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                </div>
             )}
        </div>
        <div 
          ref={scrollContainerRef}
          className="flex-1 bg-[#e5e5e5] overflow-auto relative custom-scrollbar bg-[radial-gradient(#ccc_1px,transparent_1px)] [background-size:32px_32px]"
        >
          <div className="min-w-full min-h-full flex p-12 md:p-32">
            <LayoutGroup>
              <div 
                className="relative transition-all duration-1000 ease-in-out shrink-0 m-auto" 
                style={{ 
                  width: `${2000 * zoom}px`,
                  height: `${2000 * zoom}px`
                }}
              >
                <div 
                  className="absolute top-0 left-0 transition-transform duration-1000 ease-in-out" 
                  style={{ 
                    transform: `scale(${zoom})`,
                    width: '2000px',
                    height: '2000px',
                    transformOrigin: '0 0'
                  }}
                >
              <div className="absolute inset-0 bg-[#E8F3E6] border-[40px] border-[#c8e2c3] rounded-[6rem] shadow-[0_80px_200px_rgba(0,0,0,0.25)] ring-2 ring-black/[0.05] overflow-hidden">
                {/* 3D City Center structures */}
                <div className="absolute inset-[400px] pointer-events-none z-0 grid grid-cols-4 grid-rows-4 gap-8 p-12">
                   {Array.from({ length: 16 }).map((_, i) => (
                      <div key={i} className={cn(
                        "rounded-2xl border border-black/5 shadow-xl relative overflow-hidden transition-all duration-1000",
                        i % 3 === 0 ? "bg-[#DDEBDB]" : i % 2 === 0 ? "bg-[#CDE3CD]" : "bg-[#f5fbf5]"
                      )}>
                         <div className="absolute inset-0 opacity-10">
                            {i % 4 === 0 ? <Building2 className="w-full h-full p-4" /> : i % 3 === 0 ? <Home className="w-full h-full p-6" /> : <Landmark className="w-full h-full p-8" />}
                         </div>
                         <div className="absolute top-0 left-0 w-full h-1 bg-white/20" />
                         <div className="absolute bottom-0 left-0 w-full h-4 bg-black/5 flex gap-1 px-2 items-center">
                            <div className="w-1 h-1 rounded-full bg-white/30" />
                            <div className="w-1 h-1 rounded-full bg-white/30" />
                         </div>
                      </div>
                   ))}
                   <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
                      <h1 className="text-[25rem] font-serif italic text-black tracking-[0.2em] leading-none select-none">METROPOLIS</h1>
                   </div>
                </div>
                <div className="grid grid-cols-[repeat(51,minmax(0,1fr))] grid-rows-[repeat(51,minmax(0,1fr))] h-full w-full p-4">
              {BOARD_SPACES.map((space) => {
                const isCorner = space.type === 'corner';
                let gridArea = "";
                if (space.id === 0) gridArea = "51 / 51";
                else if (space.id <= 49) gridArea = `51 / ${51 - space.id}`;
                else if (space.id === 50) gridArea = "51 / 1";
                else if (space.id <= 99) gridArea = `${51 - (space.id - 50)} / 1`;
                else if (space.id === 100) gridArea = "1 / 1";
                else if (space.id <= 149) gridArea = `1 / ${space.id - 99}`;
                else if (space.id === 150) gridArea = "1 / 51";
                else gridArea = `${space.id - 149} / 51`;

                const ownership = properties.find(p => p.space_id === space.id);
                const owner = ownership ? players.find(p => p.id === ownership.owner_id) : null;
                const isSelected = currentPlayer?.position === space.id;

                return (
                  <div 
                    key={space.id} 
                    id={`space-${space.id}`}
                    style={{ gridArea }} 
                    className={cn(
                      "border-[0.5px] border-black/10 relative flex flex-col items-center bg-white transition-all overflow-hidden group",
                      isCorner && "bg-gray-100",
                      isSelected && "ring-4 ring-blue-500 ring-inset z-20 shadow-2xl"
                    )}
                  >
                    {space.color && (
                      <div className={cn(
                        "absolute w-full h-[15%]", 
                        space.id < 10 && "top-0", 
                        space.id > 10 && space.id < 20 && "right-0 h-full w-[15%]", 
                        space.id > 20 && space.id < 30 && "bottom-0", 
                        space.id > 30 && "left-0 h-full w-[15%]"
                      )} style={{ backgroundColor: space.color + 'dd' }} />
                    )}
                    
                    {isCorner && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03]">
                         {space.id === 0 && <Home className="w-48 h-48" />}
                         {space.id === 50 && <Skull className="w-48 h-48" />}
                         {space.id === 100 && <Plane className="w-48 h-48" />}
                         {space.id === 150 && <Landmark className="w-48 h-48" />}
                      </div>
                    )}
                    <div className="z-10 p-0.5 md:p-1 flex flex-col items-center justify-center h-full w-full text-center">
                      <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-tight text-gray-900 leading-tight">
                        {space.name}
                      </span>
                      {space.price && <span className="text-[7px] md:text-[9px] font-mono text-black/50 mt-auto font-bold">${space.price}</span>}
                    </div>

                    {ownership && ownership.buildings > 0 && (
                      <div className="absolute inset-0 flex flex-col items-center justify-end p-2 pointer-events-none">
                        <div className="flex gap-0.5 items-end h-full">
                          {Array.from({ length: ownership.buildings }).map((_, i) => (
                            <motion.div 
                              key={i}
                              initial={{ y: 20, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              className={cn(
                                "w-2 md:w-4 rounded-t-sm shadow-sm border border-black/5",
                                i === 4 ? "bg-red-500 h-[60%]" : "bg-blue-600 h-[40%]"
                              )}
                              style={{ 
                                height: i === 4 ? '70%' : `${30 + (i * 10)}%`,
                                backgroundColor: i === 4 ? '#ef4444' : '#2563eb'
                              }}
                            >
                               <div className="w-full h-1 bg-white/20 mt-1" />
                               <div className="w-full h-1 bg-white/10 mt-0.5" />
                            </motion.div>
                          ))}
                        </div>
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

              {/* Center Branding */}
              <div className="col-start-2 col-end-50 row-start-2 row-end-50 flex flex-col items-center justify-center p-4">
                <div className="text-center mb-8 md:mb-12">
                   <h1 className="text-[15rem] font-serif italic text-black/[0.03] tracking-[0.2em] leading-none select-none">TYCOON</h1>
                </div>

                {/* Views are now in the global overlay */}
                {currentPlayer && view === 'stocks' && (
                  <div className="relative pointer-events-auto w-full max-w-4xl bg-white border border-black/10 p-12 rounded-3xl shadow-2xl flex flex-col gap-10">
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-sm uppercase tracking-[0.5em] font-black opacity-30">Global Market</span>
                        <h2 className="text-4xl font-serif italic text-black">Exchange</h2>
                      </div>
                      <div className="bg-gray-50 border border-black/5 px-6 py-4 rounded-2xl flex flex-col items-end">
                        <span className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Your Portfolio Value</span>
                        <span className="text-xl font-mono font-black">${Object.entries(playerStocks).reduce((acc, [symbol, amount]) => {
                          const stock = stocks.find(s => s.symbol === symbol);
                          return acc + (stock?.price || 0) * (amount as number);
                        }, 0).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {stocks.map(stock => (
                        <div key={stock.symbol} className="bg-gray-50/50 border border-black/[0.03] p-8 rounded-2xl flex flex-col gap-6">
                           <div className="flex justify-between items-start">
                             <div className="flex items-center gap-4">
                               <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center border border-black/5">
                                 {stock.symbol === 'AMZN' && <Plane className="w-6 h-6 text-orange-500" />}
                                 {stock.symbol === 'WDWS' && <Building2 className="w-6 h-6 text-blue-500" />}
                                 {stock.symbol === 'META' && <Users className="w-6 h-6 text-blue-600" />}
                                 {stock.symbol === 'EBAY' && <Briefcase className="w-6 h-6 text-red-500" />}
                                 {stock.symbol === 'PEAR' && <MapPin className="w-6 h-6 text-gray-800" />}
                               </div>
                               <div>
                                 <h3 className="text-lg font-black uppercase tracking-tight">{stock.name}</h3>
                                 <span className="text-xs opacity-40 font-mono">{stock.symbol}</span>
                               </div>
                             </div>
                             <div className="text-right">
                               <span className="text-2xl font-mono font-black">${stock.price}</span>
                               <div className={cn("text-[10px] font-black flex items-center justify-end gap-1", stock.change >= 0 ? "text-green-600" : "text-red-500")}>
                                 {stock.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                 {stock.change}%
                               </div>
                             </div>
                           </div>

                           <div className="h-32 w-full">
                             <ResponsiveContainer width="100%" height="100%">
                               <AreaChart data={stock.history}>
                                 <defs>
                                   <linearGradient id={`colorPrice-${stock.symbol}`} x1="0" y1="0" x2="0" y2="1">
                                     <stop offset="5%" stopColor={stock.change >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0.3}/>
                                     <stop offset="95%" stopColor={stock.change >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0}/>
                                   </linearGradient>
                                 </defs>
                                 <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '12px' }} />
                                 <Area type="monotone" dataKey="price" stroke={stock.change >= 0 ? "#10b981" : "#ef4444"} fillOpacity={1} fill={`url(#colorPrice-${stock.symbol})`} />
                               </AreaChart>
                             </ResponsiveContainer>
                           </div>

                           <div className="flex items-center justify-between gap-4 pt-4 border-t border-black/5">
                             <div className="flex flex-col">
                               <span className="text-[8px] uppercase tracking-widest opacity-40 font-bold">Owned</span>
                               <span className="text-lg font-mono font-black">{playerStocks[stock.symbol] || 0}</span>
                             </div>
                             <div className="flex gap-2">
                               <button onClick={() => buyStock(stock.symbol, 1)} className="px-6 py-3 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-zinc-800 transition-all">Buy $</button>
                               <button onClick={() => sellStock(stock.symbol, 1)} className="px-6 py-3 border border-black/10 text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-100 transition-all">Sell $</button>
                             </div>
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentPlayer && view === 'board' && (
                  <div className="relative pointer-events-auto scale-150 transform">
                    <div className="relative bg-white border border-black/10 p-12 rounded-3xl flex flex-col items-center min-w-[500px] shadow-2xl">
                      <div className="text-sm uppercase tracking-[0.5em] font-black opacity-30 mb-8">YOUR TURN</div>
                      
                      <div className="flex gap-12 mb-14">
                        <motion.div 
                          animate={rolling ? { 
                            rotateY: [0, 180, 360, 540, 720],
                            rotateX: [0, 90, 180, 270, 360],
                            scale: [1, 1.4, 0.8, 1.2, 1],
                            z: [0, 50, -50, 20, 0]
                          } : {}}
                          transition={{ duration: 0.5, repeat: rolling ? Infinity : 0, ease: "easeInOut" }}
                          className="w-24 h-24 md:w-32 md:h-32 bg-white border-4 border-black/10 rounded-2xl flex items-center justify-center shadow-xl relative preserve-3d"
                         >
                            <div className="absolute inset-0 bg-gradient-to-br from-white via-gray-50 to-white rounded-xl shadow-inner" />
                            <div className="relative z-10 text-blue-600">
                              {diceVisual[0] === 1 && <Dice1 className="w-16 h-16 md:w-20 md:h-20" />}
                              {diceVisual[0] === 2 && <Dice2 className="w-16 h-16 md:w-20 md:h-20" />}
                              {diceVisual[0] === 3 && <Dice3 className="w-16 h-16 md:w-20 md:h-20" />}
                              {diceVisual[0] === 4 && <Dice4 className="w-16 h-16 md:w-20 md:h-20" />}
                              {diceVisual[0] === 5 && <Dice5 className="w-16 h-16 md:w-20 md:h-20" />}
                              {diceVisual[0] === 6 && <Dice6 className="w-16 h-16 md:w-20 md:h-20" />}
                            </div>
                         </motion.div>
                      </div>

                      <button 
                        onClick={rollDice} 
                        disabled={rolling} 
                        className="px-12 md:px-20 py-5 md:py-8 bg-blue-600 text-white font-black uppercase tracking-[0.4em] text-[12px] md:text-lg hover:bg-black transition-all disabled:opacity-20 disabled:cursor-not-allowed rounded-full w-full shadow-2xl active:scale-95 flex items-center justify-center gap-4 group"
                      >
                        {rolling ? (
                          <div className="flex gap-2">
                             <div className="w-2 h-2 bg-white rounded-full animate-bounce" />
                             <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:0.2s]" />
                             <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:0.4s]" />
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <div className="flex items-center gap-4">
                              <Dices className="w-6 h-6 md:w-8 md:h-8 group-hover:rotate-12 transition-transform" />
                              <span>ROLL</span>
                            </div>
                          </div>
                        )}
                      </button>
                      


                    </div>
                  </div>
                )}
                {currentPlayer && view === 'transfer' && (
                  <div className="relative pointer-events-auto w-full max-w-2xl bg-white border border-black/10 p-12 rounded-3xl shadow-2xl flex flex-col gap-10">
                    <div className="flex flex-col">
                      <span className="text-sm uppercase tracking-[0.5em] font-black opacity-30">Money</span>
                      <h2 className="text-4xl font-serif italic text-black">Transfer</h2>
                    </div>

                    <div className="space-y-4 pt-4">
                      {players.filter(p => p.id !== currentPlayer.id).map(p => (
                        <div key={p.id} className="flex items-center justify-between p-6 bg-gray-50 border border-black/5 rounded-2xl group hover:border-blue-500/30 transition-all">
                           <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-mono shadow-sm" style={{ backgroundColor: p.player_color + '22', color: p.player_color }}>
                               {p.name.charAt(0)}
                             </div>
                             <div className="flex flex-col">
                               <span className="text-sm font-black uppercase tracking-tight">{p.name}</span>
                               <span className="text-[10px] opacity-40 uppercase tracking-widest font-bold">Account Holder</span>
                             </div>
                           </div>
                           <div className="flex gap-4">
                             {[100, 500, 1000].map(amt => (
                               <button 
                                 key={amt}
                                 onClick={() => transferMoney(p.id, amt)}
                                 disabled={currentPlayer.balance < amt}
                                 className="px-4 py-2 bg-white border border-black/10 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-black hover:text-white transition-all disabled:opacity-20"
                               >
                                 + ${amt}
                               </button>
                             ))}
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      </LayoutGroup>
    </div>
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
                 <button 
                  onClick={() => {
                    setIsJoined(false);
                    setCurrentPlayer(null);
                    setPlayerName('');
                    setShowSidebar(false);
                  }}
                  className="mt-6 w-full py-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" /> Switch Player
                </button>
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

      {/* Navigation HUD (Floating at bottom of screen) */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] flex items-center bg-black/90 backdrop-blur-2xl rounded-3xl p-3 border border-white/20 shadow-[0_30px_60px_rgba(0,0,0,0.5)] gap-6 pointer-events-auto scale-90 md:scale-100">
          <div className="flex border-r border-white/10 pr-4 gap-2">
            <button 
              onClick={() => setZoom(prev => Math.min(2, prev + 0.1))}
              className="p-3 text-white hover:bg-white/10 rounded-2xl transition-all"
              title="Zoom In"
            >
              <TrendingUp className="w-5 h-5 text-green-400" />
            </button>
            <button 
              onClick={() => setZoom(prev => Math.max(0.1, prev - 0.1))}
              className="p-3 text-white hover:bg-white/10 rounded-2xl transition-all"
              title="Zoom Out"
            >
                <TrendingDown className="w-5 h-5 text-red-400" />
            </button>
            <button 
              onClick={() => setIsFollowing(!isFollowing)}
              className={cn(
                "p-3 rounded-2xl transition-all flex items-center gap-2",
                isFollowing ? "bg-blue-600 text-white" : "text-white/40 hover:text-white"
              )}
              title="Toggle Follow Player"
            >
              <MapPin className="w-5 h-5" />
              <span className="text-[10px] uppercase tracking-widest font-black">{isFollowing ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          <div className="flex gap-2">
            {[
              { id: 'board', icon: Home, label: 'Map' },
              { id: 'stocks', icon: TrendingUp, label: 'Market' },
              { id: 'transfer', icon: ArrowRightLeft, label: 'Trade' },
              { id: 'stats', icon: Users, label: 'Network' }
            ].map(v => (
              <button 
                key={v.id}
                onClick={() => setView(v.id as any)}
                className={cn(
                  "px-6 py-4 rounded-2xl flex items-center gap-4 transition-all group",
                  view === v.id ? "bg-white text-black font-black" : "text-white/40 hover:text-white"
                )}
              >
                <v.icon className="w-5 h-5 transition-transform group-hover:scale-110" />
                <span className="text-[11px] uppercase tracking-widest leading-none font-black">{v.label}</span>
              </button>
            ))}
          </div>
      </div>

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

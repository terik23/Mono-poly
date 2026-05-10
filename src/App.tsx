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
  Target,
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
  Bell,
  Plus,
  Minus
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

interface Message {
  id: string;
  player_id: string;
  player_name: string;
  text: string;
  created_at: string;
}

interface SocialConnection {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted';
  sender_name?: string;
  receiver_name?: string;
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
  const [diceVisual, setDiceVisual] = useState([1, 1]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [view, setView] = useState<'board' | 'stocks' | 'transfer' | 'stats'>('board');
  const [zoom, setZoom] = useState(0.4);
  const [isFollowing, setIsFollowing] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Player | null>(null);
  const [friends, setFriends] = useState<SocialConnection[]>([]);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  
  // Auto-follow logic
  useEffect(() => {
    if (isFollowing && currentPlayer && scrollContainerRef.current) {
      const space = document.getElementById(`space-${currentPlayer.position}`);
      if (space) {
        const container = scrollContainerRef.current;
        
        const spaceRect = space.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Robust centering using bounding rects
        // We use a small threshold to avoid jitter if it's already mostly centered
        const centerX = spaceRect.left + spaceRect.width / 2;
        const centerY = spaceRect.top + spaceRect.height / 2;
        const viewportCenterX = containerRect.left + containerRect.width / 2;
        const viewportCenterY = containerRect.top + containerRect.height / 2;

        const diffX = centerX - viewportCenterX;
        const diffY = centerY - viewportCenterY;

        if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
          container.scrollTo({
            left: container.scrollLeft + diffX,
            top: container.scrollTop + diffY,
            behavior: 'smooth'
          });
        }
      }
    }
  }, [isFollowing, currentPlayer?.position, currentPlayer?.id, zoom]);

  const centerOnMe = () => {
    if (currentPlayer && scrollContainerRef.current) {
      const space = document.getElementById(`space-${currentPlayer.position}`);
      if (space) {
        const container = scrollContainerRef.current;
        const spaceRect = space.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const centerX = spaceRect.left + spaceRect.width / 2;
        const centerY = spaceRect.top + spaceRect.height / 2;
        const viewportCenterX = containerRect.left + containerRect.width / 2;
        const viewportCenterY = containerRect.top + containerRect.height / 2;
        const diffX = centerX - viewportCenterX;
        const diffY = centerY - viewportCenterY;
        container.scrollTo({
          left: container.scrollLeft + diffX,
          top: container.scrollTop + diffY,
          behavior: 'smooth'
        });
      }
    }
  };

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

      // Fetch Chat
      const { data: msgData } = await supabase
        .from('messages')
        .select('*')
        .eq('game_id', gid)
        .order('created_at', { ascending: false })
        .limit(50);
      if (msgData) setMessages(msgData.reverse());

      // Fetch Social
      if (currentPlayer) {
        const { data: socialData } = await supabase
          .from('social_connections')
          .select('*')
          .or(`sender_id.eq.${currentPlayer.id},receiver_id.eq.${currentPlayer.id}`);
        if (socialData) setFriends(socialData);
      }
    } catch (e: any) {
      console.error("Fetch Data Error:", e);
      setErrorMsg(`Data Synchronization Error: ${e.message}`);
    }
  }, [currentPlayer?.id]);

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
        const isMobile = vw < 768;
        const size = Math.min(vw * (isMobile ? 1.5 : 0.8), vh * (isMobile ? 1.5 : 0.8));
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
        // Higher volatility for "Tycoon" feel
        const isExtreme = Math.random() < 0.15; 
        const volatility = isExtreme ? 0.45 : 0.08;
        const direction = Math.random() < 0.52 ? 1 : -1; // Slight upward bias for growth
        
        // Occasional "Moon" event
        const isMoon = Math.random() < 0.02;
        const currentChange = isMoon ? 1.5 : (direction * Math.random() * volatility);
        const newPrice = Math.max(5.0, s.price * (1 + currentChange)); // Minimum price $5
        
        if (isMoon) {
          addToast(`${s.name} IS MOONING! 🚀`, "success");
        }
        
        // Ensure history always has at least 20 points for smooth charts
        const currentHistory = s.history.length > 0 ? s.history : Array.from({ length: 20 }).map((_, i) => ({
          time: new Date(Date.now() - (20 - i) * 30000).toLocaleTimeString(),
          price: s.price
        }));

        const newHistory = [...currentHistory.slice(-19), { 
          time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }), 
          price: Number(newPrice.toFixed(2)) 
        }];

        return { 
          ...s, 
          price: Number(newPrice.toFixed(2)), 
          history: newHistory,
          change: Number((currentChange * 100).toFixed(2))
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
    }, 10000); // 10 seconds per update for more activity
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
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages'
      }, (payload) => {
        const msg = payload.new as Message;
        setMessages(prev => [...prev.slice(-49), msg]);
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'social_connections'
      }, () => {
        fetchData(gameId);
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
      setDiceVisual([Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1]);
      await new Promise(r => setTimeout(r, 60));
    }

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    setDiceVisual([d1, d2]);
    const move = d1 + d2;
    
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

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentPlayer) return;

    const msg = {
      game_id: gameId,
      player_id: currentPlayer.id,
      player_name: currentPlayer.name,
      text: newMessage.trim(),
    };

    setNewMessage('');
    await supabase.from('messages').insert(msg);
  };

  const sendFriendRequest = async (receiverId: string) => {
    if (!currentPlayer) return;
    const { error } = await supabase.from('social_connections').insert({
      sender_id: currentPlayer.id,
      receiver_id: receiverId,
      status: 'pending'
    });
    if (error) {
      if (error.code === '23505') addToast("Request already sent", "info");
      else addToast("Social error", "error");
    } else {
      addToast("Friend request sent!", "success");
    }
  };

  const acceptFriendRequest = async (requestId: string) => {
    await supabase.from('social_connections').update({ status: 'accepted' }).eq('id', requestId);
    addToast("Accepted friend request", "success");
  };

  const isFriend = (playerId: string) => {
    return friends.some(f => 
      f.status === 'accepted' && 
      (f.sender_id === playerId || f.receiver_id === playerId)
    );
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
          <button 
            onClick={() => setSelectedProfile(currentPlayer)}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
             <div className="flex flex-col text-right">
                <span className="text-[8px] not-italic uppercase tracking-widest opacity-40 font-bold">Player</span>
                <span className="text-black text-[10px] md:text-xs font-bold font-sans uppercase tracking-tight">{currentPlayer?.name}</span>
             </div>
             <div className="w-9 h-9 md:w-10 md:h-10 rounded-sm border border-black/5 flex items-center justify-center text-xs font-mono shadow-sm" style={{ backgroundColor: currentPlayer?.player_color + '22', color: currentPlayer?.player_color }}>
                {currentPlayer?.name.charAt(0)}
             </div>
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">

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
                            className="z-40 drop-shadow-[0_15px_30px_rgba(0,0,0,0.4)] cursor-pointer pointer-events-auto group/token"
                            onClick={() => setSelectedProfile(p)}
                          >
                            <AnimatePresence>
                              {(isFriend(p.id) || p.id === currentPlayer?.id) && (
                                <motion.div
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black text-white text-[10px] font-black px-2 py-1 rounded shadow-xl uppercase tracking-widest z-50 pointer-events-none"
                                >
                                  {p.name}
                                </motion.div>
                              )}
                            </AnimatePresence>
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
          "bg-white border-b md:border-r border-black/5 flex flex-col transition-all duration-500 ease-in-out shrink-0",
          "fixed inset-0 z-[140] w-full md:relative md:inset-auto md:w-[400px] md:z-0",
          showSidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:w-0 overflow-hidden border-none"
        )}>
          {/* Mobile Close Button */}
          <div className="md:hidden absolute top-6 right-6 z-10">
            <button onClick={() => { setShowSidebar(false); setView('board'); }} className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex flex-col p-6 md:p-10 overflow-y-auto custom-scrollbar">
            {view === 'board' && (
              <div className="flex-1 flex flex-col gap-8 md:gap-12">
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

                {/* Scoreboard */}
                {currentPlayer && (
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                       <div className="text-[10px] uppercase tracking-widest font-black opacity-20">Scoreboard</div>
                       <div className="text-[10px] font-black text-blue-600/50">{players.length} PLAYER(S)</div>
                    </div>
                    <div className="space-y-2 pb-4">
                      {players.sort((a, b) => b.balance - a.balance).map((p, idx) => (
                        <div key={p.id} className="flex items-center gap-4 p-3 bg-white border border-black/[0.03] rounded-sm hover:border-black/10 transition-all group cursor-pointer" onClick={() => setSelectedProfile(p)}>
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
                )}
              </div>
            )}

            {view === 'stocks' && (
              <div className="flex-1 flex flex-col gap-6">
                <div className="flex justify-between items-center">
                   <h2 className="text-xl font-serif italic">Global Markets</h2>
                   <TrendingUp className="text-green-500 w-5 h-5" />
                </div>
                {stocks.map(s => (
                  <div key={s.symbol} className="bg-gray-50 border border-black/[0.03] p-4 rounded-2xl flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest opacity-30">{s.symbol}</div>
                        <div className="text-sm font-bold uppercase">{s.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-mono font-black">${s.price.toFixed(2)}</div>
                        <div className={cn("text-[10px] font-bold", s.change >= 0 ? "text-green-600" : "text-red-600")}>
                          {s.change >= 0 ? '+' : ''}{s.change}%
                        </div>
                      </div>
                    </div>
                    <div className="h-16 w-full">
                       <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={s.history}>
                             <Area type="monotone" dataKey="price" stroke={s.change >= 0 ? '#16a34a' : '#dc2626'} fill={s.change >= 0 ? '#dcfce7' : '#fee2e2'} />
                          </AreaChart>
                       </ResponsiveContainer>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => buyStock(s.symbol, 1)} className="flex-1 py-2 bg-black text-white text-[10px] font-black uppercase rounded-lg">Buy 1</button>
                       <button onClick={() => sellStock(s.symbol, 1)} className="flex-1 py-2 bg-gray-200 text-black text-[10px] font-black uppercase rounded-lg">Sell 1</button>
                    </div>
                    {playerStocks[s.symbol] > 0 && (
                      <div className="text-[9px] font-black uppercase tracking-widest opacity-40 text-center">Owned: {playerStocks[s.symbol]}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {view === 'transfer' && (
               <div className="flex-1 flex flex-col gap-8">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-serif italic">Money Transfer</h2>
                    <ArrowRightLeft className="text-blue-600 w-5 h-5" />
                  </div>
                  <div className="space-y-4">
                    {players.filter(p => p.id !== currentPlayer?.id).map(p => (
                      <div key={p.id} className="bg-gray-50 border border-black/[0.03] p-4 rounded-2xl flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full" style={{ backgroundColor: p.player_color }} />
                            <span className="text-[11px] font-black uppercase">{p.name}</span>
                         </div>
                         <div className="flex gap-1">
                            {[100, 500].map(amt => (
                               <button 
                                 key={amt}
                                 onClick={() => transferMoney(p.id, amt)}
                                 className="px-2 py-1 bg-white border border-black/5 text-[9px] font-black rounded-lg"
                               >
                                 +${amt}
                               </button>
                            ))}
                         </div>
                      </div>
                    ))}
                  </div>
               </div>
            )}

            {view === 'stats' && (
               <div className="flex-1 flex flex-col gap-8">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-serif italic">Network Contacts</h2>
                    <Users className="text-blue-600 w-5 h-5" />
                  </div>
                  {/* Reuse the social list but bigger */}
                  <div className="space-y-4">
                    {players.map(p => (
                      <div key={p.id} onClick={() => setSelectedProfile(p)} className="bg-white border border-black/[0.03] p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:border-blue-200 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl" style={{ backgroundColor: p.player_color + '22', color: p.player_color }}>
                             <div className="w-full h-full flex items-center justify-center font-mono font-black">{p.name.charAt(0)}</div>
                          </div>
                          <div>
                            <div className="text-[11px] font-black uppercase">{p.name}</div>
                            <div className="text-[9px] font-mono opacity-40">${p.balance.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            )}
          </div>
        </aside>
      </main>

      {/* Profile Modal */}
      <AnimatePresence>
        {selectedProfile && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProfile(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col border border-black/10"
            >
              <div className="relative h-32 w-full" style={{ backgroundColor: selectedProfile.player_color }}>
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent" />
                <button 
                  onClick={() => setSelectedProfile(null)}
                  className="absolute top-6 right-6 w-10 h-10 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-8 pb-10 -mt-16 relative flex flex-col items-center">
                <div 
                  className="w-32 h-32 rounded-[2rem] border-8 border-white shadow-xl flex items-center justify-center text-4xl font-black text-white mb-6"
                  style={{ backgroundColor: selectedProfile.player_color }}
                >
                  {selectedProfile.name.charAt(0)}
                </div>
                
                <h2 className="text-2xl font-black uppercase tracking-tight text-gray-900">{selectedProfile.name}</h2>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30 mt-1">Tycoon Operator</span>

                <div className="grid grid-cols-2 gap-4 w-full mt-10">
                  <div className="bg-gray-50 p-6 rounded-3xl border border-black/[0.03] flex flex-col items-center">
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-30 mb-2">Cash Balance</span>
                    <span className="text-xl font-mono font-black text-green-600">${selectedProfile.balance.toLocaleString()}</span>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-3xl border border-black/[0.03] flex flex-col items-center">
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-30 mb-2">Properties</span>
                    <span className="text-xl font-mono font-black text-blue-600">
                      {properties.filter(p => p.owner_id === selectedProfile.id).length}
                    </span>
                  </div>
                </div>

                <div className="w-full mt-8 space-y-4">
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-20 ml-2">Portfolio Details</div>
                  <div className="max-h-48 overflow-y-auto w-full space-y-2 custom-scrollbar pr-2">
                    {properties.filter(p => p.owner_id === selectedProfile.id).map(prop => {
                      const space = BOARD_SPACES[prop.space_id];
                      return (
                        <div key={prop.space_id} className="flex items-center justify-between p-4 bg-gray-50/50 border border-black/[0.02] rounded-2xl">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-6 rounded-full" style={{ backgroundColor: space.color || '#ccc' }} />
                            <span className="text-xs font-black uppercase tracking-tight">{space.name}</span>
                          </div>
                          <span className="text-[10px] font-mono opacity-40">${space.price}</span>
                        </div>
                      );
                    })}
                    {properties.filter(p => p.owner_id === selectedProfile.id).length === 0 && (
                      <div className="text-center py-6 text-[10px] uppercase tracking-widest opacity-20 font-black italic">No assets acquired</div>
                    )}
                  </div>
                </div>

                {currentPlayer?.id !== selectedProfile.id && (
                  <div className="w-full mt-8 pt-8 border-t border-black/5">
                    {isFriend(selectedProfile.id) ? (
                      <div className="w-full py-4 bg-green-50 text-green-600 text-[10px] font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2">
                        <Users className="w-4 h-4" /> Friends
                      </div>
                    ) : (
                      <>
                        {friends.find(f => f.sender_id === selectedProfile.id && f.receiver_id === currentPlayer?.id && f.status === 'pending') ? (
                          <button 
                            onClick={() => {
                              const req = friends.find(f => f.sender_id === selectedProfile.id && f.receiver_id === currentPlayer?.id && f.status === 'pending');
                              if (req) acceptFriendRequest(req.id);
                            }}
                            className="w-full py-5 bg-blue-600 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-black transition-all shadow-xl"
                          >
                            Accept Friend Request
                          </button>
                        ) : friends.find(f => f.sender_id === currentPlayer?.id && f.receiver_id === selectedProfile.id && f.status === 'pending') ? (
                          <button disabled className="w-full py-5 bg-gray-100 text-gray-400 text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl cursor-not-allowed">
                            Request Pending
                          </button>
                        ) : (
                          <button 
                            onClick={() => sendFriendRequest(selectedProfile.id)}
                            className="w-full py-5 bg-black text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-blue-600 transition-all shadow-xl flex items-center justify-center gap-3"
                          >
                            <Plus className="w-4 h-4" /> Send Friend Request
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Chat UI */}
      <AnimatePresence>
        {showChat && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed bottom-28 left-4 right-4 md:left-8 md:bottom-auto md:top-24 md:w-80 h-[400px] md:h-[500px] bg-white rounded-[2rem] border border-black/10 shadow-[0_30px_90px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden z-[120]"
          >
            <div className="p-6 border-b border-black/5 bg-gray-50 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Frequency 1</span>
                <h3 className="text-sm font-black uppercase tracking-tight">World Chat</h3>
              </div>
              <button 
                onClick={() => setShowChat(false)}
                className="w-8 h-8 rounded-full border border-black/5 flex items-center justify-center hover:bg-black hover:text-white transition-all"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {messages.map((m, idx) => (
                <div key={m.id || idx} className={cn("flex flex-col gap-1", m.player_id === currentPlayer?.id ? "items-end" : "items-start")}>
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[8px] font-black uppercase tracking-widest opacity-30">{m.player_name}</span>
                  </div>
                  <div className={cn(
                    "px-4 py-3 rounded-2xl text-[12px] leading-relaxed max-w-[85%] shadow-sm",
                    m.player_id === currentPlayer?.id ? "bg-blue-600 text-white rounded-tr-none" : "bg-gray-100 text-gray-800 rounded-tl-none border border-black/5"
                  )}>
                    {m.text}
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-10 gap-4 mt-20">
                  <Send className="w-12 h-12" />
                  <span className="text-[10px] font-black uppercase tracking-widest">No messages yet</span>
                </div>
              )}
            </div>

            <form onSubmit={sendMessage} className="p-4 bg-gray-50 border-t border-black/5 flex gap-2">
              <input 
                type="text" 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Message Tycoons..."
                className="flex-1 bg-white border border-black/10 rounded-xl px-4 py-2 text-[12px] outline-none focus:border-blue-500 transition-all font-medium"
              />
              <button className="w-10 h-10 bg-black text-white rounded-xl flex items-center justify-center hover:bg-blue-600 transition-all active:scale-95 shadow-lg shrink-0">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed top-24 right-6 z-[110] md:top-24 md:left-10">
        <button 
          onClick={() => setShowChat(!showChat)}
          className={cn(
            "w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center shadow-2xl transition-all active:scale-90 relative",
            showChat ? "bg-black text-white" : "bg-white text-black hover:bg-gray-50 border border-black/10"
          )}
        >
          <Briefcase className="w-5 h-5 md:w-6 md:h-6" />
          {messages.length > 0 && !showChat && (
            <div className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center text-[8px] text-white font-black">
              !
            </div>
          )}
        </button>
      </div>


      {/* Fixed Dice Roll Area (Always Visible) */}
      <AnimatePresence>
        {isJoined && currentPlayer && (
          <motion.div 
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            className="fixed bottom-28 right-4 md:bottom-32 md:right-8 z-[90] flex flex-col items-center gap-4 pointer-events-auto"
          >
            <motion.div 
              animate={rolling ? { 
                rotate: [0, 360],
                rotateX: [0, 360],
                scale: [1, 1.1, 1],
              } : {}}
              transition={{ duration: 0.3, repeat: rolling ? Infinity : 0 }}
              className="w-32 h-20 md:w-40 md:h-24 bg-white border border-black/10 rounded-3xl shadow-2xl flex flex-col items-center justify-center relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white to-gray-50 opacity-50" />
              <div className="flex gap-3 md:gap-4 items-center">
                {diceVisual.map((v, i) => (
                  <div key={i} className="relative z-10 text-blue-600">
                    {v === 1 && <Dice1 className="w-8 h-8 md:w-10 md:h-10" />}
                    {v === 2 && <Dice2 className="w-8 h-8 md:w-10 md:h-10" />}
                    {v === 3 && <Dice3 className="w-8 h-8 md:w-10 md:h-10" />}
                    {v === 4 && <Dice4 className="w-8 h-8 md:w-10 md:h-10" />}
                    {v === 5 && <Dice5 className="w-8 h-8 md:w-10 md:h-10" />}
                    {v === 6 && <Dice6 className="w-8 h-8 md:w-10 md:h-10" />}
                  </div>
                ))}
              </div>
              {!rolling && (
                <div className="mt-1 text-[10px] font-black text-blue-600 opacity-50 font-mono">
                  SUM: {diceVisual[0] + diceVisual[1]}
                </div>
              )}
            </motion.div>

            <button 
              onClick={rollDice}
              disabled={rolling}
              className="group relative flex flex-col items-center justify-center w-20 h-20 md:w-28 md:h-28 bg-blue-600 hover:bg-black text-white rounded-[2rem] md:rounded-[2.5rem] shadow-[0_25px_60px_rgba(37,99,235,0.45)] transition-all active:scale-90 disabled:opacity-50 disabled:grayscale border-4 border-white/20"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
              {rolling ? (
                 <div className="flex gap-1.5">
                    <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-white rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-white rounded-full animate-bounce [animation-delay:0.1s]" />
                    <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-white rounded-full animate-bounce [animation-delay:0.2s]" />
                 </div>
              ) : (
                <>
                  <Dices className="w-8 h-8 md:w-10 md:h-10 mb-1 group-hover:rotate-12 transition-transform drop-shadow-lg" />
                  <span className="text-[9px] md:text-[11px] font-black tracking-[0.2em]">ROLL</span>
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation HUD (Floating at bottom of screen) */}
      <div className="fixed bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 z-[100] flex items-center bg-black/90 backdrop-blur-2xl rounded-3xl p-2 md:p-3 border border-white/20 shadow-[0_30px_60px_rgba(0,0,0,0.5)] gap-3 md:gap-6 pointer-events-auto max-md:w-[90%] max-md:justify-center">
          <div className="flex border-r border-white/10 pr-2 md:pr-4 gap-1 md:gap-2 shrink-0">
            <button 
              onClick={() => setZoom(prev => Math.min(2, prev + 0.1))}
              className="p-2 md:p-3 text-white hover:bg-white/10 rounded-2xl transition-all"
              title="Zoom In"
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5 text-green-400" />
            </button>
            <button 
              onClick={() => setZoom(prev => Math.max(0.1, prev - 0.1))}
              className="p-2 md:p-3 text-white hover:bg-white/10 rounded-2xl transition-all"
              title="Zoom Out"
            >
                <Minus className="w-4 h-4 md:w-5 md:h-5 text-red-400" />
            </button>
            <button 
              onClick={() => setIsFollowing(!isFollowing)}
              className={cn(
                "p-2 md:p-3 rounded-2xl transition-all flex items-center gap-1 md:gap-2",
                isFollowing ? "bg-blue-600 text-white" : "text-white/40 hover:text-white"
              )}
              title="Toggle Follow Player"
            >
              <MapPin className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-[8px] md:text-[10px] uppercase tracking-widest font-black hidden sm:inline">{isFollowing ? 'ON' : 'OFF'}</span>
            </button>
            <button 
              onClick={centerOnMe}
              className="p-2 md:p-3 text-white hover:bg-white/10 rounded-2xl transition-all flex items-center gap-1"
              title="Find My Player"
            >
              <Target className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
              <span className="text-[8px] md:text-[10px] uppercase font-black">ME</span>
            </button>
          </div>

          <div className="flex gap-1 md:gap-2 overflow-x-auto custom-scrollbar no-scrollbar scroll-smooth">
            {[
              { id: 'board', icon: Home, label: 'Map' },
              { id: 'stocks', icon: TrendingUp, label: 'Stocks' },
              { id: 'transfer', icon: ArrowRightLeft, label: 'Trade' },
              { id: 'stats', icon: Users, label: 'Players' }
            ].map(v => (
              <button 
                key={v.id}
                onClick={() => setView(v.id as any)}
                className={cn(
                  "px-3 md:px-6 py-3 md:py-4 rounded-2xl flex items-center gap-2 md:gap-4 transition-all group shrink-0",
                  view === v.id ? "bg-white text-black font-black" : "text-white/40 hover:text-white"
                )}
              >
                <v.icon className={cn("w-4 h-4 md:w-5 md:h-5 transition-transform group-hover:scale-110", view === v.id ? "text-blue-600" : "")} />
                <span className="text-[9px] md:text-[11px] uppercase tracking-widest leading-none font-black">{v.label}</span>
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

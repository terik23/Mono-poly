/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { BOARD_SPACES } from './constants';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { 
  Building2, 
  MapPin, 
  Building,
  ShieldAlert,
  Wallet, 
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
  Zap,
  Plus,
  Minus,
  Camera,
  Heart
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
import confetti from 'canvas-confetti';

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

interface Company {
  id: string;
  game_id: string;
  owner_id: string;
  owner_name: string;
  name: string;
  base_price: number;
  history?: { price: number; time: string }[];
  created_at: string;
}

interface Shareholder {
  id: string;
  company_id: string;
  player_id: string;
  shares: number;
}

interface Message {
  id: string;
  game_id: string;
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
  debt: number;
  position: number;
  last_roll_at: string | null;
  last_daily_at: string;
  player_color: string;
  avatar_url?: string;
  is_bankrupt?: boolean;
  debt_started_at?: string | null;
  negative_since?: string | null;
}

interface PropertyOwnership {
  space_id: number;
  game_id: string;
  owner_id: string | null;
  buildings: number;
  is_mortgaged?: boolean;
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
  const [view, setView] = useState<'board' | 'stocks' | 'transfer' | 'stats' | 'chat_history' | 'casino'>('board');
  const [zoom, setZoom] = useState(0.4);
  const [casinoPot, setCasinoPot] = useState(0);
  const [reels, setReels] = useState(['💎', '💎', '💎']);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Player | null>(null);
  const [friends, setFriends] = useState<SocialConnection[]>([]);
  const [empresaList, setEmpresaList] = useState<Company[]>([]);
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [moneyChanges, setMoneyChanges] = useState<{ id: string; amount: number; x: number; y: number }[]>([]);
  const [isCreatingEmpresa, setIsCreatingEmpresa] = useState(false);
  const [newEmpresaName, setNewEmpresaName] = useState('');
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'info' | 'error' | 'success' }[]>([]);
  const [isGoldenActive, setIsGoldenActive] = useState(false);
  const [stocks, setStocks] = useState<Stock[]>([
    { symbol: 'AMZN', name: 'Anazona', price: 150, history: [], change: 0 },
    { symbol: 'WDWS', name: 'Windidows', price: 280, history: [], change: 0 },
    { symbol: 'META', name: 'Metas', price: 310, history: [], change: 0 },
    { symbol: 'EBAY', name: 'Ebais', price: 45, history: [], change: 0 },
    { symbol: 'PEAR', name: 'Pear', price: 190, history: [], change: 0 },
  ]);
  const [playerStocks, setPlayerStocks] = useState<Record<string, number>>({}); // symbol -> amount
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [missingTables, setMissingTables] = useState<string[]>([]);
  const missingTablesRef = React.useRef<Set<string>>(new Set());
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const chatScrollRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentPlayer) return;

    if (file.size > 1200000) { // Limit to ~1.2MB for Base64 storage
      addToast("Image too large (Max 1.2MB).", "error");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      
      try {
        const { error } = await supabase
          .from('players')
          .update({ avatar_url: base64String })
          .eq('id', currentPlayer.id);

        if (error) {
          console.error("Supabase update error:", error);
          if (error.code === 'PGRST204' || error.code === '42703') {
            addToast("Database column missing. Please run the SQL fix in System Logs.", "error");
          } else {
            throw error;
          }
          return;
        }

        // Update local state
        const updatedPlayer = { ...currentPlayer, avatar_url: base64String };
        setCurrentPlayer(updatedPlayer);
        setSelectedProfile(updatedPlayer);
        setPlayers(prev => prev.map(p => p.id === currentPlayer.id ? updatedPlayer : p));
        addToast("Profile photo updated!", "success");
      } catch (err) {
        console.error("Avatar update error:", err);
        addToast("Failed to upload. Try a smaller image.", "error");
      }
    };
    reader.readAsDataURL(file);
  };

  const retryConnection = () => {
    missingTablesRef.current.clear();
    setMissingTables([]);
    fetchData(gameId);
    addToast("Re-scanning database for new tables...", "info");
  };
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

  const addToast = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev.filter(t => t.id !== id), { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  const fetchData = useCallback(async (gid: string) => {
    try {
      const fetchSafely = async (tableName: string, query: any) => {
        if (missingTablesRef.current.has(tableName)) return null;
        
        const { data, error } = await query;
        if (error) {
          if (error.code === '42P01' || error.code === 'PGRST205') {
            if (!missingTablesRef.current.has(tableName)) {
              missingTablesRef.current.add(tableName);
              setMissingTables(Array.from(missingTablesRef.current));
              console.warn(`Supabase table '${tableName}' missing. Social/Chat features disabled until SQL is run.`);
            }
            return null;
          }
          throw error;
        }
        
        // If it worked but was previously missing, remove it
        if (missingTablesRef.current.has(tableName)) {
          missingTablesRef.current.delete(tableName);
          setMissingTables(Array.from(missingTablesRef.current));
        }
        
        return data;
      };

      const pData = await fetchSafely('players', supabase.from('players').select('*').eq('game_id', gid));
      if (pData) {
        setPlayers(pData);
        
        // AUTO-ELIMINATION: Check for negative balance > 24h
        pData.forEach(async (p: any) => {
          if (p.negative_since) {
             const negStart = new Date(p.negative_since).getTime();
             const now = Date.now();
             const diffHours = (now - negStart) / (1000 * 60 * 60);
             if (diffHours >= 24) {
                // Delete player and properties
                await supabase.from('players').delete().eq('id', p.id);
                await supabase.from('properties').delete().eq('owner_id', p.id);
                addToast(`Account ELIMINATED: ${p.name} had negative balance for >24h`, "error");
             }
          }
        });
      }

      const propData = await fetchSafely('properties', supabase.from('properties').select('*').eq('game_id', gid));
      if (propData) setProperties(propData);

      // Fetch Chat
      const msgData = await fetchSafely('messages', supabase
        .from('messages')
        .select('*')
        .eq('game_id', gid)
        .order('created_at', { ascending: false })
        .limit(50));
      
      if (msgData) {
        setMessages(prev => {
          const fetched = [...msgData].reverse();
          const combined = [...prev, ...fetched];
          const unique = combined.filter((msg, index, self) => 
            index === self.findIndex((m) => (
              (m.id && msg.id && m.id === msg.id) || 
              (m.player_id === msg.player_id && m.text === msg.text && Math.abs(new Date(m.created_at || 0).getTime() - new Date(msg.created_at || 0).getTime()) < 1000)
            ))
          );
          return unique.sort((a, b) => {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return timeA - timeB;
          }).slice(-200);
        });
      }

      // Fetch Social
      if (currentPlayer) {
        const socialData = await fetchSafely('social_connections', supabase
          .from('social_connections')
          .select('*')
          .or(`sender_id.eq.${currentPlayer.id},receiver_id.eq.${currentPlayer.id}`));
        
        if (socialData) setFriends(socialData);
      }

      // Fetch Companies
      const compData = await fetchSafely('empresa', supabase
        .from('empresa')
        .select('*')
        .eq('game_id', gid));
      if (compData) setEmpresaList(compData);

      const shareData = await fetchSafely('shareholders', supabase
        .from('shareholders')
        .select('*'));
      if (shareData) setShareholders(shareData);

      // Fetch Player Stocks
      if (currentPlayer) {
        const stockData = await fetchSafely('player_stocks', supabase
          .from('player_stocks')
          .select('*')
          .eq('player_id', currentPlayer.id));
        
        if (stockData) {
          const stockMap: Record<string, number> = {};
          stockData.forEach((s: any) => {
            stockMap[s.symbol] = s.amount;
          });
          setPlayerStocks(stockMap);
        }
      }

      // 24 Hour Message Cleanup Logic (Silent Fail)
      if (!missingTablesRef.current.has('messages')) {
        try {
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          await supabase.from('messages').delete().lt('created_at', oneDayAgo);
        } catch (cleanErr) {
          // ignore
        }
      }

      const bankData = await fetchSafely('bank', supabase.from('bank').select('amount'));
      if (bankData) {
        const total = bankData.reduce((acc: number, curr: any) => acc + curr.amount, 0);
        setCasinoPot(total);
      }

    } catch (e: any) {
      console.error("Fetch Data Error:", e);
      setErrorMsg(`Synchronization Lag: Reconnecting...`); // Softer error message
    }
  }, [currentPlayer?.id]);

  // Auto-scroll chat and initial fetch
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Periodic fetch (less aggressive)
  useEffect(() => {
    fetchData(gameId);
    const interval = setInterval(() => fetchData(gameId), 10000);
    return () => clearInterval(interval);
  }, [fetchData, gameId]);

  useEffect(() => {
    const checkGolden = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      
      // Inicia a las 14:45 (2:45 PM) y dura 5 minutos
      const isActive = hours === 14 && minutes >= 45 && minutes < 50;
      
      if (isActive && !isGoldenActive) {
        addToast("🌟 ¡EVENTO DORADO ACTIVO! Los precios han bajado y obtienes $100 por moverte.", "success");
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FFD700', '#FDB813', '#B8860B']
        });
      }
      setIsGoldenActive(isActive);
    };

    checkGolden();
    const interval = setInterval(checkGolden, 10000);
    return () => clearInterval(interval);
  }, [isGoldenActive]);

  // Handle incoming transfer notifications
  useEffect(() => {
    if (!currentPlayer) return;
    
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.text.startsWith('[SYSTEM_TRANSFER]')) {
      const [, fromId, toId, amount, fromName] = lastMsg.text.split('|');
      if (toId === currentPlayer.id) {
        // This is for me!
        const amt = parseInt(amount);
        addToast(`🎁 Recibiste $${amt.toLocaleString()} de ${fromName}!`, "success");
        confetti({
          particleCount: 100,
          spread: 50,
          origin: { y: 0.7 }
        });
      }
    }
  }, [messages, currentPlayer?.id]);

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



  // Stock Market Fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      setStocks(prev => prev.map(s => {
        // High volatility for "Tycoon" feel, but less frequent (1 min)
        const isExtreme = Math.random() < 0.1; 
        const volatility = isExtreme ? 0.35 : 0.05;
        const direction = Math.random() < 0.55 ? 1 : -1; // Slight upward bias
        
        // Downward changes are less drastic
        const multiplier = direction === -1 ? 0.6 : 1.0;
        
        // Occasional "Moon" event
        const isMoon = Math.random() < 0.01;
        const currentChange = isMoon ? 1.2 : (direction * Math.random() * volatility * multiplier);
        const newPrice = Math.max(5.0, s.price * (1 + currentChange)); // Minimum price $5
        
        if (isMoon) {
          addToast(`${s.name} IS MOONING! 🚀`, "success");
        }
        
        // Ensure history always has at least 20 points for smooth charts
        const currentHistory = s.history.length > 0 ? s.history : Array.from({ length: 20 }).map((_, i) => ({
          time: new Date(Date.now() - (20 - i) * 60000).toLocaleTimeString(),
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
    }, 60000); // Changed to 1 minute as requested
    return () => clearInterval(interval);
  }, []);

  const buyStock = async (symbol: string, amount: number) => {
    const stock = stocks.find(s => s.symbol === symbol);
    if (!stock || !currentPlayer) return;
    const cost = stock.price * amount;
    
    // Loan check: Have at least 50%
    const canAfford = currentPlayer.balance >= cost;
    const canLoan = currentPlayer.balance >= cost * 0.5;

    if (!canAfford && !canLoan) {
      addToast("Insufficient funds (Requires 50% for Loan)", "error");
      return;
    }

    const downPayment = canAfford ? cost : cost * 0.5;
    const loanAmount = canAfford ? 0 : (cost * 0.5) * 1.25;

    const newAmount = (playerStocks[symbol] || 0) + amount;
    
    // Sync to Supabase
    const { error } = await supabase
      .from('player_stocks')
      .upsert({ 
        player_id: currentPlayer.id, 
        symbol: symbol, 
        amount: newAmount,
        updated_at: new Date().toISOString()
      }, { onConflict: 'player_id,symbol' });

    if (error && error.code !== '42P01') {
       console.error("Stock Sync Error:", error);
    }

    setPlayerStocks(prev => ({
      ...prev,
      [symbol]: newAmount
    }));

    handleBalanceUpdate(currentPlayer.id, -downPayment);
    if (loanAmount > 0) {
      updateDebt(currentPlayer.id, loanAmount);
      addToast(`Loan approved: $${loanAmount.toFixed(0)} added to debt`, "info");
    }
  };

  const sellStock = async (symbol: string, amount: number) => {
    const stock = stocks.find(s => s.symbol === symbol);
    const owned = playerStocks[symbol] || 0;
    if (!stock || !currentPlayer || owned < amount) return;

    const profit = stock.price * amount;
    const newAmount = owned - amount;

    // Sync to Supabase
    const { error } = await supabase
      .from('player_stocks')
      .upsert({ 
        player_id: currentPlayer.id, 
        symbol: symbol, 
        amount: newAmount,
        updated_at: new Date().toISOString()
      }, { onConflict: 'player_id,symbol' });

    if (error && error.code !== '42P01') {
       console.error("Stock Sync Error:", error);
    }

    setPlayerStocks(prev => ({
      ...prev,
      [symbol]: newAmount
    }));

    handleBalanceUpdate(currentPlayer.id, profit);
    addToast(`Sold ${amount} shares of ${stock.name} for $${profit.toFixed(2)}`, "success");
  };

  const createEmpresa = async () => {
    if (!currentPlayer || !newEmpresaName) return;

    // Limit to one empresa per person
    const hasEmpresa = empresaList.some(e => e.owner_id === currentPlayer.id);
    if (hasEmpresa) {
      addToast("Solo puedes tener una empresa a la vez.", "error");
      return;
    }

    if (currentPlayer.balance < 10000) {
      addToast("Insufficient funds. Empresa requires $10,000", "error");
      return;
    }

    const { data, error } = await supabase
      .from('empresa')
      .insert({
        game_id: gameId,
        owner_id: currentPlayer.id,
        owner_name: currentPlayer.name,
        name: newEmpresaName,
        base_price: 1000,
      })
      .select()
      .single();

    if (error) {
      console.error("Create Empresa Error:", error);
      if (error.code === '42P01' || error.code === 'PGRST205') {
        const localId = Math.random().toString();
        const localComp = {
          id: localId,
          game_id: gameId,
          owner_id: currentPlayer.id,
          owner_name: currentPlayer.name,
          name: newEmpresaName,
          base_price: 1000,
          created_at: new Date().toISOString()
        };
        setEmpresaList(prev => [...prev, localComp]);
        addToast("Empresa started in local memory (Table missing)", "info");
      } else {
        addToast(`Empresa error: ${error.message}`, "error");
        return;
      }
    }

    await handleBalanceUpdate(currentPlayer.id, -10000);
    setIsCreatingEmpresa(false);
    setNewEmpresaName('');
    addToast(`${newEmpresaName} has been founded!`, "success");
  };

  const investInEmpresa = async (companyId: string, shares: number) => {
    if (!currentPlayer) return;
    const company = empresaList.find(c => c.id === companyId);
    if (!company) return;

    // RULE: CANNOT BUY YOUR OWN COMPANY
    if (company.owner_id === currentPlayer.id) {
      addToast("You cannot invest in your own company's private shares.", "error");
      return;
    }

    const owner = players.find(p => p.id === company.owner_id);
    const multiplier = owner ? (Math.max(100, owner.balance) / 10000) : 1;
    const pricePerShare = company.base_price * multiplier;
    const totalCost = pricePerShare * shares;
    const canAfford = currentPlayer.balance >= totalCost;
    const canLoan = currentPlayer.balance >= totalCost * 0.5;

    if (!canAfford && !canLoan) {
      addToast("Insufficient funds even for a loan (Requires 50%)", "error");
      return;
    }

    const downPayment = canAfford ? totalCost : totalCost * 0.5;
    const loanAmount = canAfford ? 0 : (totalCost * 0.5) * 1.25;

    const { error } = await supabase
      .from('shareholders')
      .insert({
        company_id: companyId,
        player_id: currentPlayer.id,
        shares: shares
      });

    if (error) {
      console.error("Investment Error Details:", error);
      if (error.code === '42P01' || error.code === 'PGRST205' || error.code === '23503') {
        addToast("Database Sync Delay. Local fallback active.", "info");
        
        // Fallback for local play
        setShareholders(prev => [...prev, {
          id: Math.random().toString(),
          company_id: companyId,
          player_id: currentPlayer.id,
          shares: shares
        }]);
      } else {
        addToast(`Investment failed: ${error.message}`, "error");
        return;
      }
    }

    await handleBalanceUpdate(currentPlayer.id, -downPayment);
    if (loanAmount > 0) {
      updateDebt(currentPlayer.id, loanAmount);
      addToast(`Financing applied: $${loanAmount.toFixed(0)} debt`, "info");
    }
    addToast(`Invested in ${company.name}!`, "success");
  };

  const updateDebt = async (playerId: string, delta: number) => {
     const player = players.find(p => p.id === playerId);
     if (!player) return;
     const newDebt = Math.max(0, (player.debt || 0) + delta);
     
     setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, debt: newDebt } : p));
     if (currentPlayer?.id === playerId) {
        setCurrentPlayer(prev => prev ? { ...prev, debt: newDebt } : null);
     }

     await supabase.from('players').update({ debt: newDebt }).eq('id', playerId);
  };

  const handleCasinoBet = async (amount: number) => {
    if (!currentPlayer || currentPlayer.balance < amount || isSpinning) {
      if (!isSpinning) addToast("Insufficient funds for this bet!", "error");
      return;
    }

    const symbols = ['🍒', '🍋', '💎', '🔔', '7️⃣', '⭐', '🍊', '🍇', '👑', '🃏'];
    setIsSpinning(true);

    // Start visual spinning
    const spinInterval = setInterval(() => {
      setReels([
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)]
      ]);
    }, 80);

    try {
      // 1. Deduct from player
      const { error: deductError } = await supabase
        .from('players')
        .update({ balance: currentPlayer.balance - amount })
        .eq('id', currentPlayer.id);
      
      if (deductError) {
        clearInterval(spinInterval);
        setIsSpinning(false);
        throw deductError;
      }

      // 2. Record in bank
      await supabase.from('bank').insert({
        player_id: currentPlayer.id,
        player_name: currentPlayer.name,
        amount: amount
      });

      // 3. Luck logic - Higher bets increase winning odds
      const winProbability = Math.min(0.45, 0.08 + (Math.log10(amount / 100) * 0.12));
      const win = Math.random() < winProbability;
      
      // Secondary win logic (2 of a kind)
      const partialWin = !win && Math.random() < 0.25;

      const terik = players.find(p => p.name.toUpperCase() === 'TERIK');

      // Stop spin after 2 seconds
      setTimeout(async () => {
        clearInterval(spinInterval);
        
        let finalReels;
        if (win) {
          const winSymbol = symbols[Math.floor(Math.random() * symbols.length)];
          finalReels = [winSymbol, winSymbol, winSymbol];
        } else if (partialWin) {
          const pairSymbol = symbols[Math.floor(Math.random() * symbols.length)];
          let third = symbols[Math.floor(Math.random() * symbols.length)];
          while (third === pairSymbol) {
             third = symbols[Math.floor(Math.random() * symbols.length)];
          }
          const order = [pairSymbol, pairSymbol, third].sort(() => Math.random() - 0.5);
          finalReels = order;
        } else {
          const s1 = symbols[Math.floor(Math.random() * symbols.length)];
          let s2 = symbols[Math.floor(Math.random() * symbols.length)];
          let s3 = symbols[Math.floor(Math.random() * symbols.length)];
          if (s1 === s2 && s2 === s3) {
            s3 = symbols[(symbols.indexOf(s3) + 1) % symbols.length];
          }
          finalReels = [s1, s2, s3];
        }
        
        setReels(finalReels);
        setIsSpinning(false);

        if (win) {
          const prize = amount * 5;
          await supabase.from('players')
            .update({ balance: (currentPlayer.balance - amount) + prize })
            .eq('id', currentPlayer.id);
          addToast(`JACKPOT! You won $${prize.toLocaleString()}!`, "success");
        } else if (partialWin) {
          const prize = Math.floor(amount * 1.5);
          await supabase.from('players')
            .update({ balance: (currentPlayer.balance - amount) + prize })
            .eq('id', currentPlayer.id);
          addToast(`MINI-WIN! Pairs matched! You won $${prize.toLocaleString()}!`, "success");
        } else {
          // 50% consolation prize
          const refund = Math.floor(amount * 0.5);
          const toBank = amount - refund;

          if (refund > 0) {
            await supabase.from('players')
              .update({ balance: (currentPlayer.balance - amount) + refund })
              .eq('id', currentPlayer.id);
          }

          if (terik) {
            await supabase.from('players')
              .update({ balance: terik.balance + toBank })
              .eq('id', terik.id);
          }
          addToast(`La apuesta se fue al banco. El casino te devolvió el 50% ($${refund.toLocaleString()}) como consolación.`, "info");
        }
        fetchData(gameId);
      }, 2000);

    } catch (err) {
      clearInterval(spinInterval);
      setIsSpinning(false);
      console.error("Casino error:", err);
      addToast("Casino machine jammed.", "error");
    }
  };

  const handleBalanceUpdate = async (playerId: string, delta: number) => {
    // Show visual indicator if it's the current player
    if (currentPlayer && playerId === currentPlayer.id) {
       const id = Math.random().toString();
       setMoneyChanges(prev => [...prev, { id, amount: delta, x: window.innerWidth / 2, y: window.innerHeight / 2 }]);
       setTimeout(() => setMoneyChanges(prev => prev.filter(m => m.id !== id)), 2000);
    }

    const player = players.find(p => p.id === playerId);
    if (!player) return;
    
    const newBalance = player.balance + delta;
    
    // Track negative balance for 24h automatic deletion
    let negativeSince = player.negative_since;
    if (newBalance < 0 && !negativeSince) {
      negativeSince = new Date().toISOString();
    } else if (newBalance >= 0) {
      negativeSince = null;
    }

    await supabase.from('players').update({ 
      balance: newBalance,
      negative_since: negativeSince
    }).eq('id', playerId);
  };

  const sellProperty = async (spaceId: number) => {
    const prop = properties.find(p => p.space_id === spaceId);
    if (!prop || !currentPlayer || prop.owner_id !== currentPlayer.id) return;
    
    const space = BOARD_SPACES[spaceId];
    const salePrice = Math.floor(space.price * 0.7); // Sell for 70%
    
    await supabase.from('properties').delete().eq('space_id', spaceId);
    await handleBalanceUpdate(currentPlayer.id, salePrice);
    addToast(`${space.name} vendida por $${salePrice.toLocaleString()}`, "info");
    fetchData(gameId);
  };

  const mortgageProperty = async (spaceId: number) => {
    const prop = properties.filter(p => p.space_id === spaceId)[0];
    if (!prop || !currentPlayer || prop.owner_id !== currentPlayer.id) return;

    if (prop.is_mortgaged) {
      // Repay mortgage
      const space = BOARD_SPACES[spaceId];
      const cost = Math.floor(space.price * 0.6);
      if (currentPlayer.balance < cost) {
        addToast("No tienes suficiente para levantar la hipoteca.", "error");
        return;
      }
      await supabase.from('properties').update({ is_mortgaged: false }).eq('space_id', spaceId);
      await handleBalanceUpdate(currentPlayer.id, -cost);
      addToast(`Hipotecada levantada de ${space.name}`, "success");
    } else {
      // Mortgage
      const space = BOARD_SPACES[spaceId];
      const reward = Math.floor(space.price * 0.5); // Mortgage for 50%
      await supabase.from('properties').update({ is_mortgaged: true }).eq('space_id', spaceId);
      await handleBalanceUpdate(currentPlayer.id, reward);
      addToast(`${space.name} embargada (hipotecada) por $${reward.toLocaleString()}`, "info");
    }
    fetchData(gameId);
  };

  const transferProperty = async (toPlayerId: string, spaceId: number) => {
    const prop = properties.find(p => p.space_id === spaceId);
    if (!prop || !currentPlayer || prop.owner_id !== currentPlayer.id) return;

    await supabase.from('properties')
      .update({ owner_id: toPlayerId })
      .eq('space_id', spaceId);
    
    addToast(`${BOARD_SPACES[spaceId].name} transferida a otro jugador`, "success");
    fetchData(gameId);
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
        if (msg.game_id === gameId) {
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev.slice(-99), msg];
          });
        }
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'social_connections'
      }, () => {
        fetchData(gameId);
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'empresa'
      }, () => {
        fetchData(gameId);
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'shareholders'
      }, () => {
        fetchData(gameId);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log("Realtime connected for game:", gameId);
        }
      });

    // Handle initial stocks load once
    if (currentPlayer && Object.keys(playerStocks).length === 0) {
      fetchData(gameId);
    }

    // Wealth Tax Effect (5 minutes)
    const taxInterval = setInterval(async () => {
      if (currentPlayer && currentPlayer.balance >= 1000000) {
        const taxAmount = Math.floor(currentPlayer.balance * 0.005); // 0.5%
        await handleBalanceUpdate(currentPlayer.id, -taxAmount);
        addToast(`Wealth Tax Applied: -$${taxAmount.toLocaleString()}`, "error");
      }
    }, 5 * 60 * 1000);

    // Debt Repayment System (30 seconds)
    const debtInterval = setInterval(async () => {
       if (currentPlayer && (currentPlayer.debt || 0) > 0) {
          const installment = Math.min(currentPlayer.balance * 0.05, currentPlayer.debt || 0, 5000);
          if (installment > 0) {
             await handleBalanceUpdate(currentPlayer.id, -installment);
             await updateDebt(currentPlayer.id, -installment);
             addToast(`Debt Repayment: -$${installment.toLocaleString()}`, "info");
          }
       }
    }, 30000);

    // Periodic cleanup/sync check
    const syncInterval = setInterval(() => {
      fetchData(gameId);
      
      // Update Empresa History (if owner)
      if (currentPlayer) {
        empresaList.filter(c => c.owner_id === currentPlayer.id).forEach(async (c) => {
          const owner = players.find(p => p.id === c.owner_id);
          if (!owner) return;
          const currentPrice = c.base_price * (Math.max(100, owner.balance) / 10000);
          
          const newHistory = [...(c.history || [])].slice(-19); // Keep last 20
          newHistory.push({ price: currentPrice, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
          
          await supabase.from('empresa').update({ history: newHistory }).eq('id', c.id);
        });
      }
    }, 30000);
    
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
        .ilike('name', playerName)
        .maybeSingle();

      if (checkError) throw checkError;

      if (authMode === 'signup') {
        if (existingPlayer) {
          addToast("Ese usuario ya esta", "error");
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

    // Golden Event Bonus
    if (isGoldenActive) {
      balance += 100;
    }

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
        
        // Loan / Financing logic for Rent
        const canAfford = balance >= rent;
        const canLoan = balance >= rent * 0.5;

        if (canAfford) {
          balance -= rent;
          setLogs(prev => [`PAID $${rent} RENT TO ${owner.name.toUpperCase()}`, ...prev]);
        } else if (canLoan) {
          const downPayment = rent * 0.5;
          const loanDebt = (rent * 0.5) * 1.25;
          balance -= downPayment;
          updateDebt(currentPlayer.id, loanDebt);
          setLogs(prev => [`FINANCED RENT: PAID $${downPayment} + $${loanDebt.toFixed(0)} DEBT TO ${owner.name.toUpperCase()}`, ...prev]);
          addToast(`Emergency Rent Loan: $${loanDebt.toFixed(0)} debt`, "error");
        } else {
          // If totally broke, they just lose what they have and take the rest as debt
          const paid = Math.max(0, balance);
          const remaining = rent - paid;
          const loanDebt = remaining * 1.5; // Penalty for being totally broke
          balance = 0;
          updateDebt(currentPlayer.id, loanDebt);
          setLogs(prev => [`BANKRUPTCY AVOIDED: $${loanDebt.toFixed(0)} DEBT CREATED`, ...prev]);
        }

        await supabase
          .from('players')
          .update({ balance: owner.balance + rent })
          .eq('id', owner.id);
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
    if (!space.price) return;

    let cost = space.price;
    if (isGoldenActive) {
      cost = Math.floor(cost * 0.5); // 50% discount during golden event
    }
    
    const canAfford = currentPlayer.balance >= cost;
    const canLoan = currentPlayer.balance >= cost * 0.5;

    if (!canAfford && !canLoan) {
      addToast("Insufficient funds for property or financing", "error");
      return;
    }

    const { error: propError } = await supabase
      .from('properties')
      .insert({ 
        space_id: spaceId, 
        game_id: gameId, 
        owner_id: currentPlayer.id,
        buildings: 0
      });

    if (!propError) {
      const downPayment = canAfford ? cost : cost * 0.5;
      const loanDebt = canAfford ? 0 : (cost * 0.5) * 1.25;
      
      const newBalance = currentPlayer.balance - downPayment;
      
      setLogs(prev => [`Bought ${space.name} ${loanDebt > 0 ? '(Financed)' : ''} for $${downPayment}`, ...prev]);
      
      // Update local state for immediate feedback
      setProperties(prev => [...prev, {
        id: Math.random().toString(), 
        space_id: spaceId,
        game_id: gameId,
        owner_id: currentPlayer.id,
        buildings: 0,
        mortgaged: false
      } as any]);
      
      setCurrentPlayer({ ...currentPlayer, balance: newBalance });
      setPlayers(prev => prev.map(p => p.id === currentPlayer.id ? { ...p, balance: newBalance } : p));
      
      if (loanDebt > 0) {
        updateDebt(currentPlayer.id, loanDebt);
        addToast(`Property financed: $${loanDebt.toFixed(0)} debt added`, "info");
      }

      await supabase
        .from('players')
        .update({ balance: newBalance })
        .eq('id', currentPlayer.id);
    }
  };

  const buildHouse = async (spaceId: number) => {
    const space = BOARD_SPACES[spaceId];
    const ownership = properties.find(p => p.space_id === spaceId);
    if (!ownership || ownership.owner_id !== currentPlayer?.id || ownership.buildings >= 5) return;
    
    let houseCost = Math.floor((space.price || 100) * 0.5);
    if (isGoldenActive) {
      houseCost = Math.floor(houseCost * 0.5);
    }
    if (currentPlayer.balance < houseCost) {
      addToast(`No tienes suficiente para construir. Costo: $${houseCost}`, "error");
      return;
    }

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
      
      // Notify recipient via messages table
      await supabase.from('messages').insert({
        game_id: gameId,
        player_id: 'SYSTEM',
        player_name: 'Tycoon System',
        text: `[SYSTEM_TRANSFER]|${currentPlayer.id}|${toPlayerId}|${amount}|${currentPlayer.name}`,
      });
    }

    if (!senderErr) {
      addToast(`Transferred $${amount} to ${target?.name}`, "success");
      setLogs(prev => [`TRANSFERRED $${amount} TO ${target?.name.toUpperCase()}`, ...prev]);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentPlayer) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    const { error } = await supabase.from('messages').insert({
      game_id: gameId,
      player_id: currentPlayer.id,
      player_name: currentPlayer.name,
      text: messageText,
    });

    if (error) {
      console.error("Chat send error:", error);
      const isTableMissing = error.code === '42P01' || error.code === 'PGRST205';
      
      if (isTableMissing) {
        // Optimistic local add since table doesn't exist
        const localMsg: Message = {
          id: Math.random().toString(),
          game_id: gameId,
          player_id: currentPlayer.id,
          player_name: currentPlayer.name,
          text: messageText,
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev.slice(-199), localMsg]);
        addToast("Message sent to local memory (Database table missing)", "info");
      } else {
        addToast(`Chat error: ${error.message}`, "error");
        setNewMessage(messageText); // Restore text on failure
      }
    }
  };

  const sendFriendRequest = async (receiverId: string) => {
    if (!currentPlayer) return;
    const { error } = await supabase.from('social_connections').insert({
      sender_id: currentPlayer.id,
      receiver_id: receiverId,
      status: 'pending'
    });
    if (error) {
      console.error("Social error:", error);
      if (error.code === '23505') addToast("Request already sent", "info");
      else if (error.code === '42P01') addToast("Social table missing. Please check schema.", "error");
      else addToast(`Social error: ${error.message}`, "error");
    } else {
      addToast("Friend request sent!", "success");
    }
  };

  const acceptFriendRequest = async (requestId: string) => {
    await supabase.from('social_connections').update({ status: 'accepted' }).eq('id', requestId);
    addToast("Accepted friend request", "success");
    setSelectedProfile(null);
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
              <Landmark className="text-blue-600 w-12 h-12" />
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
    <div className={cn(
      "h-screen text-gray-900 font-sans flex flex-col overflow-hidden select-none transition-all duration-1000",
      isGoldenActive ? "bg-amber-100 shadow-[inset_0_0_150px_rgba(251,191,36,0.4)]" : "bg-[#fcfcf9]"
    )}>
      {isGoldenActive && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="fixed inset-0 pointer-events-none z-[50] bg-gradient-to-b from-amber-200/20 to-amber-500/10"
        />
      )}
      {/* Floating Money Labels */}
      <AnimatePresence>
        {moneyChanges.map(m => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, scale: 0.5, y: -50 }}
            animate={{ opacity: 1, scale: 1.5, y: -200 }}
            exit={{ opacity: 0, scale: 0.8, y: -300 }}
            className={cn(
              "fixed left-1/2 -translate-x-1/2 z-[9999] pointer-events-none font-black text-4xl drop-shadow-2xl uppercase tracking-tighter italic",
              m.amount > 0 ? "text-emerald-500" : "text-rose-600"
            )}
          >
            {m.amount > 0 ? '+' : ''}${Math.abs(m.amount).toLocaleString()}
            <div className="text-[10px] text-center opacity-50 not-italic tracking-[0.2em] -mt-1 uppercase">
              {m.amount > 0 ? 'Transaction Received' : 'Capital Reduction'}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Toasts (Apple Style) */}
      <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[1000] flex flex-col gap-2 w-full max-w-[400px] px-4 pointer-events-none">
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
             <div className="w-9 h-9 md:w-10 md:h-10 rounded-sm border border-black/5 flex items-center justify-center text-xs font-mono shadow-sm overflow-hidden" style={{ backgroundColor: currentPlayer?.player_color + '22', color: currentPlayer?.player_color }}>
                {currentPlayer?.avatar_url ? (
                  <img src={currentPlayer.avatar_url} className="w-full h-full object-cover" alt={currentPlayer.name} referrerPolicy="no-referrer" />
                ) : (
                  currentPlayer?.name.charAt(0)
                )}
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
                      {space.price && (
                        <span className="text-[7px] md:text-[9px] font-mono mt-auto font-bold text-black/50">
                          ${space.price}
                        </span>
                      )}
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
                                  initial={{ opacity: 0, y: 10, scale: 0.8 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/90 backdrop-blur-md text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-2xl uppercase tracking-[0.1em] z-50 pointer-events-none flex items-center gap-2 border border-white/20"
                                >
                                  {isFriend(p.id) && <Heart className="w-2.5 h-2.5 text-rose-500 fill-rose-500" />}
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
                <div className="flex justify-between items-center bg-black text-white p-6 rounded-3xl -mx-2 shadow-2xl">
                   <div>
                     <h2 className="text-2xl font-serif italic">Global Markets</h2>
                     <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Financial District</p>
                   </div>
                   <motion.div
                     animate={{ rotate: 360 }}
                     transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                   >
                     <TrendingUp className="text-green-400 w-8 h-8" />
                   </motion.div>
                </div>

                {/* START EMPRESA BUTTON */}
                {isJoined && currentPlayer && (
                  <div className="bg-blue-600 p-6 rounded-3xl text-white shadow-xl">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Corporate Registry</div>
                        <div className="text-lg font-black uppercase">Found Your Empire</div>
                      </div>
                      <Briefcase className="w-8 h-8 opacity-20" />
                    </div>
                    {isCreatingEmpresa ? (
                      <div className="space-y-4">
                        <input 
                          type="text" 
                          placeholder="EMPRESA NAME (E.G. STARK IND)" 
                          value={newEmpresaName}
                          onChange={(e) => setNewEmpresaName(e.target.value.toUpperCase())}
                          className="w-full bg-white/20 border border-white/30 rounded-xl px-4 py-3 text-sm font-black uppercase placeholder:text-white/40 focus:outline-none focus:bg-white/30"
                        />
                        <div className="flex gap-2">
                          <button 
                            onClick={createEmpresa}
                            className="flex-1 py-3 bg-white text-blue-600 text-[10px] font-black uppercase rounded-xl"
                          >
                            FOUND EMPRESA ($10,000)
                          </button>
                          <button 
                            onClick={() => setIsCreatingEmpresa(false)}
                            className="px-4 py-3 bg-black/20 text-white text-[10px] font-black uppercase rounded-xl"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setIsCreatingEmpresa(true)}
                        className="w-full py-4 bg-white text-blue-600 font-black uppercase text-[11px] tracking-widest rounded-2xl shadow-lg flex items-center justify-center gap-3 hover:scale-105 transition-transform"
                      >
                        <Plus className="w-4 h-4" /> Start Empresa ($10,000)
                      </button>
                    )}
                  </div>
                )}

                {/* PLAYER COMPANIES */}
                {empresaList.length > 0 && (
                  <div className="space-y-4">
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-30 px-1">Corporate Index</div>
                    {empresaList.map(c => {
                      const owner = players.find(p => p.id === c.owner_id);
                      const multiplier = owner ? (Math.max(100, owner.balance) / 10000) : 1;
                      const price = c.base_price * multiplier;
                      const myShares = shareholders.filter(s => s.company_id === c.id && s.player_id === currentPlayer?.id).reduce((acc, s) => acc + s.shares, 0);

                      // Generate stable chart data for visual polish
                      const chartData = c.history?.length ? c.history : [
                        { price: price * 0.92, time: '08:00' },
                        { price: price * 0.95, time: '09:00' },
                        { price: price * 0.98, time: '10:00' },
                        { price: price, time: '11:00' }
                      ];

                      return (
                        <div key={c.id} className="bg-white border border-black/5 p-6 rounded-[2rem] shadow-sm hover:shadow-md transition-all group overflow-hidden">
                          <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                                  <Building2 className="w-6 h-6" />
                               </div>
                               <div>
                                 <h3 className="text-sm font-black uppercase text-gray-900 leading-none mb-1">{c.name}</h3>
                                 <div className="flex items-center gap-2">
                                    <span className="text-[8px] font-black uppercase text-blue-600">CEO: {c.owner_name}</span>
                                    <div className="w-1 h-1 bg-black/10 rounded-full" />
                                    <span className={cn("text-[8px] font-black uppercase", multiplier >= 1 ? "text-green-500" : "text-amber-500")}>
                                      {multiplier >= 1.5 ? 'Market Dominance' : multiplier >= 1 ? 'Stable' : 'Volatile'}
                                    </span>
                                 </div>
                               </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-mono font-black text-gray-900">${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                              <div className="text-[8px] font-black uppercase text-gray-400 flex items-center justify-end gap-1">
                                <TrendingUp className="w-2 h-2" />
                                Market Valuation
                              </div>
                            </div>
                          </div>

                          {/* Enterprise Performance Chart */}
                          <div className="h-20 w-full mb-6">
                             <ResponsiveContainer width="100%" height="100%">
                               <AreaChart data={chartData}>
                                 <defs>
                                   <linearGradient id={`priceGrad-${c.id}`} x1="0" y1="0" x2="0" y2="1">
                                     <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                                     <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                   </linearGradient>
                                 </defs>
                                 <Area 
                                   type="monotone" 
                                   dataKey="price" 
                                   stroke="#2563eb" 
                                   strokeWidth={2}
                                   fillOpacity={1} 
                                   fill={`url(#priceGrad-${c.id})`} 
                                 />
                               </AreaChart>
                             </ResponsiveContainer>
                          </div>

                          {/* Locations / Buildings Display */}
                          <div className="flex items-center gap-3 mb-6 p-4 bg-gray-50 rounded-[1.5rem] border border-black/[0.02]">
                             <div className="flex -space-x-1.5">
                               {[...Array(Math.min(5, Math.ceil(multiplier * 2)))].map((_, i) => (
                                 <div key={i} className="w-9 h-9 bg-white border border-black/5 rounded-xl flex items-center justify-center shadow-sm hover:scale-110 transition-transform cursor-pointer group/loc">
                                   <Building className="w-5 h-5 text-blue-600" />
                                   <div className="absolute -top-8 bg-black text-white text-[7px] px-2 py-1 rounded-md opacity-0 group-hover/loc:opacity-100 transition-opacity">Asset Unit</div>
                                 </div>
                               ))}
                             </div>
                             <div className="flex-1">
                                <div className="text-[10px] font-black uppercase text-gray-900 tracking-tight leading-none mb-0.5">
                                  {Math.max(1, Math.floor(multiplier * 5))} Global Infrastructure
                                </div>
                                <div className="text-[8px] font-bold uppercase text-gray-400 tracking-widest leading-none">Economic Presence</div>
                             </div>
                          </div>

                          {/* Investors List */}
                          <div className="space-y-2 mb-6">
                            <div className="flex items-center justify-between">
                              <span className="text-[8px] font-black uppercase opacity-20 tracking-widest">Shareholders</span>
                              <span className="text-[8px] font-mono opacity-40">{shareholders.filter(s => s.company_id === c.id).length} Active</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {shareholders.filter(s => s.company_id === c.id).map((s, idx) => {
                                const investor = players.find(p => p.id === s.player_id);
                                return (
                                  <div key={idx} className="bg-gray-50 border border-black/[0.03] px-2.5 py-1 rounded-lg text-[8px] font-black uppercase text-gray-600 flex items-center gap-1.5">
                                    <div className="w-1 h-1 rounded-full bg-blue-500" />
                                    {investor?.name || 'Venture Fund'} <span className="opacity-40">{s.shares} Sh</span>
                                  </div>
                                );
                              })}
                              {shareholders.filter(s => s.company_id === c.id).length === 0 && (
                                <div className="text-[8px] font-black uppercase opacity-20 italic">Fully Privatized</div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                             <button 
                               onClick={() => investInEmpresa(c.id, 1)}
                               disabled={!currentPlayer || currentPlayer.balance < price || c.owner_id === currentPlayer.id}
                               className="flex-1 py-4 bg-gray-900 text-white text-[10px] font-black uppercase rounded-2xl disabled:opacity-30 flex items-center justify-center gap-2 hover:bg-black transition-colors"
                             >
                               {c.owner_id === currentPlayer?.id ? (
                                 <>
                                   <History className="w-3 h-3 opacity-40" /> Owned
                                 </>
                               ) : (
                                 <>
                                   <Briefcase className="w-3 h-3" /> Buy Share
                                 </>
                               )}
                             </button>
                          </div>
                          {myShares > 0 && (
                            <div className="bg-gray-50 border border-black/[0.03] p-2 rounded-xl flex items-center justify-between">
                               <span className="text-[8px] font-black uppercase opacity-40">Your Equity</span>
                               <span className="text-[8px] font-mono font-black">{myShares} SHARES</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="text-[10px] font-black uppercase tracking-widest opacity-30 px-1">Global Commodities</div>
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
                        <div className="h-24 w-full bg-blue-50/30 rounded-xl overflow-hidden">
                           <ResponsiveContainer width="100%" height={96}>
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
                   <div className="flex justify-between items-center px-1">
                     <div>
                       <h2 className="text-xl font-serif italic text-gray-900">Exchange</h2>
                       <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-30 italic">Transfer Assets & Funds</p>
                     </div>
                     <ArrowRightLeft className="text-blue-600 w-5 h-5" />
                   </div>

                   <div className="space-y-6">
                     <div className="text-[10px] font-black uppercase tracking-widest opacity-20 px-1 italic">Transfer Funds</div>
                     <div className="space-y-3">
                       {players.filter(p => p.id !== currentPlayer?.id).map(p => (
                         <div key={p.id} className="bg-gray-50 border border-black/[0.03] p-5 rounded-[2rem] flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-xs shadow-md" style={{ backgroundColor: p.player_color }}>
                                 {p.name.charAt(0)}
                               </div>
                               <span className="text-[11px] font-black uppercase tracking-tight text-gray-900">{p.name}</span>
                            </div>
                            <div className="flex gap-2">
                               {[100, 500, 1000].map(amt => (
                                  <button 
                                    key={amt}
                                    onClick={() => transferMoney(p.id, amt)}
                                    disabled={!currentPlayer || currentPlayer.balance < amt}
                                    className="px-4 py-2 bg-white border border-black/5 text-[9px] font-black rounded-xl hover:bg-black hover:text-white transition-all disabled:opacity-20 shadow-sm"
                                  >
                                    +${amt}
                                  </button>
                               ))}
                            </div>
                         </div>
                       ))}
                     </div>

                     <div className="pt-6 border-t border-black/5">
                        <div className="text-[10px] font-black uppercase tracking-widest opacity-20 px-1 italic mb-4">Transfer Properties</div>
                        <div className="grid grid-cols-1 gap-3">
                           {properties.filter(p => p.owner_id === currentPlayer?.id).map(prop => {
                             const space = BOARD_SPACES[prop.space_id];
                             return (
                               <div key={prop.space_id} className="bg-gray-50 border border-black/[0.03] p-5 rounded-[2rem] space-y-4 shadow-sm overflow-hidden relative">
                                  <div className="flex items-center gap-3">
                                     <div className="w-2 h-8 rounded-full" style={{ backgroundColor: space.color || '#ccc' }} />
                                     <div>
                                        <div className="text-[10px] font-black uppercase text-gray-900">{space.name}</div>
                                        <div className="text-[8px] font-mono opacity-40">Value: ${space.price}</div>
                                     </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                     {players.filter(p => p.id !== currentPlayer?.id).map(p => (
                                        <button 
                                          key={p.id}
                                          onClick={() => transferProperty(p.id, prop.space_id)}
                                          className="px-3 py-1.5 bg-white border border-black/5 text-[8px] font-black uppercase rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-xs"
                                        >
                                          Send to {p.name}
                                        </button>
                                     ))}
                                  </div>
                               </div>
                             );
                           })}
                           {properties.filter(p => p.owner_id === currentPlayer?.id).length === 0 && (
                             <div className="text-center py-10 text-[9px] font-black uppercase tracking-[0.2em] opacity-20 italic">No assets to trade</div>
                           )}
                        </div>
                     </div>
                   </div>
                </div>
             )}

            {view === 'stats' && (
               <div className="flex-1 flex flex-col gap-8">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-serif italic">Network Contacts</h2>
                    <Users className="text-blue-600 w-5 h-5" />
                  </div>
                  {/* Pending Requests Section */}
                  {friends.some(f => f.receiver_id === currentPlayer?.id && f.status === 'pending') && (
                    <div className="space-y-4 mb-6">
                      <div className="flex items-center justify-between px-1">
                        <div className="text-[10px] uppercase tracking-widest font-black text-blue-600">Pending Signals</div>
                        <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shadow-sm">
                          {friends.filter(f => f.receiver_id === currentPlayer?.id && f.status === 'pending').length}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {friends.filter(f => f.receiver_id === currentPlayer?.id && f.status === 'pending').map(req => {
                          const sender = players.find(p => p.id === req.sender_id);
                          return (
                            <div key={req.id} className="bg-blue-50 border border-blue-100/50 p-4 rounded-3xl flex items-center justify-between group">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-md">
                                  {sender?.name.charAt(0) || '?'}
                                </div>
                                <div>
                                  <div className="text-[11px] font-black uppercase text-blue-900 leading-none mb-1">{sender?.name || 'Unknown'}</div>
                                  <div className="text-[8px] font-mono text-blue-400 uppercase tracking-tighter">Connection Requested</div>
                                </div>
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  acceptFriendRequest(req.id);
                                }}
                                className="px-5 py-2.5 bg-black text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-600 transition-all shadow-sm"
                              >
                                Accept
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] uppercase tracking-widest font-black opacity-20 px-1 mb-4 flex items-center gap-2">
                    <span className="w-8 h-px bg-black opacity-10" />
                    Directory
                    <span className="flex-1 h-px bg-black opacity-10" />
                  </div>
                  <div className="space-y-4">
                    {players.map(p => (
                      <div key={p.id} onClick={() => setSelectedProfile(p)} className="p-4 rounded-2xl flex items-center justify-between cursor-pointer border transition-all bg-white border-black/[0.03] hover:border-blue-200">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl overflow-hidden relative" style={{ backgroundColor: p.player_color + '22', color: p.player_color }}>
                             <div className="w-full h-full flex items-center justify-center font-mono font-black">
                                {p.avatar_url ? (
                                  <img src={p.avatar_url} className="w-full h-full object-cover" alt={p.name} referrerPolicy="no-referrer" />
                                ) : (
                                  p.name.charAt(0)
                                )}
                             </div>
                          </div>
                          <div>
                            <div className="text-[11px] font-black uppercase flex items-center gap-1.5 text-gray-900">
                              {p.name}
                            </div>
                            <div className="text-[9px] font-mono opacity-40">${p.balance.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>
            )}

            {view === 'chat_history' && (
               <div className="flex-1 flex flex-col gap-6">
                 <div className="flex justify-between items-center px-1">
                   <div>
                     <h2 className="text-xl font-serif italic text-gray-900">System Logs</h2>
                     <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-30 italic">Registry & Management</p>
                   </div>
                   <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                     <History className="text-blue-600 w-4 h-4" />
                   </div>
                 </div>

                 {missingTables.length > 0 && (
                   <div className="bg-red-50 border border-red-100 p-5 rounded-[2rem] space-y-3">
                     <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg animate-pulse">
                         <Skull className="w-4 h-4" />
                       </div>
                       <div>
                         <div className="text-[10px] font-black uppercase text-red-900">Database Offline</div>
                         <div className="text-[8px] font-mono text-red-500 uppercase">{missingTables.length} Tables Missing</div>
                       </div>
                     </div>
                     <p className="text-[9px] text-red-700 leading-relaxed font-medium">Some tables are missing (possibly due to recent updates). Please run the <b>updated</b> SQL script below to fix this.</p>
                     <button 
                       onClick={retryConnection}
                       className="w-full py-3 bg-red-600 text-white text-[10px] font-black uppercase rounded-xl shadow-lg hover:bg-black transition-all"
                     >
                       Retry Connection
                     </button>
                   </div>
                 )}

                 <div className="bg-white border border-black/5 rounded-[2rem] overflow-hidden shadow-sm flex-1 flex flex-col min-h-[300px]">
                   <div className="bg-white text-white p-6 font-mono text-[9px] relative group">
                     <div className="flex items-center justify-between mb-4">
                       <span className="text-white font-black tracking-widest text-[8px] uppercase">Supabase Setup Script</span>
                       <button 
                         onClick={() => {
                           const sql = document.getElementById('setup-sql')?.innerText;
                           if (sql) {
                             navigator.clipboard.writeText(sql);
                             addToast("SQL Copied to Clipboard", "success");
                           }
                         }}
                         className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[7px] uppercase font-black transition-all"
                       >
                         Copy Logic
                       </button>
                     </div>
                     <div id="setup-sql" className="max-h-[300px] overflow-y-auto whitespace-pre custom-scrollbar text-[#f5f5f5] opacity-90 leading-relaxed font-mono">
{`/* SUPABASE SETUP SCRIPT - RUN THIS IN SQL EDITOR */

-- 0. CORE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. BASE TABLE UPDATES
ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS debt NUMERIC DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS negative_since TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_mortgaged BOOLEAN DEFAULT FALSE;

-- 2. CORPORATE ENTITY TABLES (EMPRESA)
CREATE TABLE IF NOT EXISTS empresa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  name TEXT NOT NULL,
  base_price NUMERIC DEFAULT 1000,
  history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE empresa DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS shareholders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL,
  player_id TEXT NOT NULL,
  shares INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_empresa FOREIGN KEY (company_id) REFERENCES empresa(id) ON DELETE CASCADE
);
ALTER TABLE shareholders DISABLE ROW LEVEL SECURITY;

-- 3. CASINO & BANK
CREATE TABLE IF NOT EXISTS bank (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT DEFAULT 'casino_bet',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bank DISABLE ROW LEVEL SECURITY;

-- 4. SOCIAL & TRADING
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS player_stocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, symbol)
);
ALTER TABLE player_stocks DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS social_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_a TEXT NOT NULL,
  player_b TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE social_connections DISABLE ROW LEVEL SECURITY;
 
-- 5. ENABLE REALTIME
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE messages, empresa, shareholders, social_connections, player_stocks, players, bank;`}
                     </div>
                     <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-[7px] text-white/40 italic uppercase tracking-widest">Run this in your Supabase SQL Editor to activate all features.</p>
                     </div>
                   </div>

                   <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                     <div className="text-[10px] uppercase font-black tracking-widest opacity-20">Live Sync Log</div>
                     {messages.length > 0 ? (
                       <div className="space-y-4">
                         {[...messages].reverse().map((m, i) => (
                           <div key={m.id || i} className="flex flex-col gap-1">
                             <div className="flex items-center justify-between">
                               <span className="text-[10px] font-black uppercase text-blue-600">{m.player_name}</span>
                               <span className="text-[8px] font-mono opacity-20">{m.created_at ? new Date(m.created_at).toLocaleTimeString() : 'NOW'}</span>
                             </div>
                             <p className="text-[11px] text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-2xl border border-black/[0.02]">
                               {m.text}
                             </p>
                           </div>
                         ))}
                       </div>
                     ) : (
                       <div className="flex flex-col items-center justify-center py-20 opacity-20 gap-4">
                         <History className="w-8 h-8" />
                         <span className="text-[10px] font-black uppercase tracking-widest italic">No events recorded</span>
                       </div>
                     )}
                   </div>
                 </div>
               </div>
            )}

            {view === 'casino' && (
              <div className="flex-1 flex flex-col gap-6">
                <div className="flex justify-between items-center bg-gradient-to-br from-amber-400 to-amber-600 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                  <div className="relative z-10">
                    <h2 className="text-3xl font-serif italic mb-1">JACKPOT TYCOON</h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">High Stakes Machine</p>
                  </div>
                  <Coins className="w-12 h-12 opacity-30 relative z-10" />
                </div>

                <div className="bg-black text-white p-8 rounded-[2.5rem] shadow-2xl space-y-8 relative border-t-4 border-amber-500 overflow-hidden">
                   {/* Slot Machine Display */}
                   <div className="bg-gradient-to-b from-gray-900 to-black p-8 rounded-[2rem] border border-white/10 shadow-inner relative">
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex gap-1">
                        <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />
                        <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse delay-75" />
                        <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse delay-150" />
                      </div>
                      
                      <div className="flex justify-center gap-4 py-4">
                         {reels.map((symbol, idx) => (
                           <motion.div 
                             key={idx}
                             animate={isSpinning ? { 
                               y: [0, -20, 20, 0],
                               scale: [1, 0.9, 1.1, 1],
                               filter: ["blur(0px)", "blur(4px)", "blur(0px)"]
                             } : {}}
                             transition={isSpinning ? { 
                               repeat: Infinity, 
                               duration: 0.15,
                               delay: idx * 0.05
                             } : { type: "spring", damping: 10 }}
                             className="w-20 h-28 bg-white/5 rounded-2xl flex items-center justify-center text-4xl shadow-xl border border-white/5 relative overflow-hidden"
                           >
                             <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40 pointer-events-none" />
                             {symbol}
                           </motion.div>
                         ))}
                      </div>
                   </div>

                  <div className="flex flex-col items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Bank Pot Total</span>
                    <span className="text-4xl font-mono font-black tracking-tighter text-white">
                      ${casinoPot.toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[100, 500, 1000, 10000, 100000].map(amt => (
                      <button 
                        key={amt}
                        onClick={() => handleCasinoBet(amt)}
                        disabled={!currentPlayer || currentPlayer.balance < amt || isSpinning}
                        className="py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black hover:bg-amber-500 hover:border-amber-600 transition-all disabled:opacity-20 active:scale-95 flex flex-col items-center gap-1 group overflow-hidden relative"
                      >
                        <div className="absolute inset-0 bg-amber-500/0 group-hover:bg-amber-500/10 transition-colors" />
                        <span className="opacity-40 group-hover:opacity-100 uppercase">Input</span>
                        <span className="text-sm font-mono">${amt.toLocaleString()}</span>
                      </button>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-white/10 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">More money = Better Odds</p>
                    <p className="text-[8px] font-medium opacity-40 mt-1 uppercase italic">Lost bets fuel the Bank of Terik</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="text-[10px] uppercase font-black tracking-widest opacity-20 px-2 italic">Recent Gamblers</div>
                  <div className="space-y-2">
                    {messages.filter(m => m.text.includes('bet') || m.text.includes('WON') || m.text.includes('JACKPOT') || m.text.includes('apuesta')).slice(-5).map((m, i) => (
                      <div key={i} className="p-4 bg-gray-50 border border-black/[0.02] rounded-2xl flex justify-between items-center">
                        <span className="text-[10px] font-black uppercase">{m.player_name}</span>
                        <span className="text-[9px] font-mono opacity-40 max-w-[200px] truncate">{m.text}</span>
                      </div>
                    ))}
                  </div>
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
              className="bg-white w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[2.5rem] shadow-2xl relative flex flex-col border border-black/10 custom-scrollbar"
            >
              <div className="relative h-32 w-full shrink-0" style={{ backgroundColor: selectedProfile.player_color }}>
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent" />
                <button 
                  onClick={() => setSelectedProfile(null)}
                  className="absolute top-6 right-6 px-4 h-10 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full flex items-center gap-2 text-white transition-all group"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Close</span>
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-8 pb-10 -mt-16 relative flex flex-col items-center">
                <div className="relative group">
                  <div 
                    className="w-32 h-32 rounded-[2rem] border-8 shadow-xl flex items-center justify-center text-4xl font-black text-white mb-6 overflow-hidden relative z-10 border-white"
                    style={{ backgroundColor: selectedProfile.player_color }}
                  >
                    {selectedProfile.avatar_url ? (
                      <img src={selectedProfile.avatar_url} className="w-full h-full object-cover" alt={selectedProfile.name} referrerPolicy="no-referrer" />
                    ) : (
                      selectedProfile.name.charAt(0)
                    )}
                  </div>
                  {currentPlayer?.id === selectedProfile.id && (
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-4 right-0 w-10 h-10 bg-black text-white rounded-2xl flex items-center justify-center shadow-lg border-4 border-white translate-x-1/4 hover:bg-blue-600 transition-all z-20"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleAvatarChange} 
                  className="hidden" 
                  accept="image/*" 
                />
                
                <h2 className="text-2xl font-black uppercase tracking-tight text-gray-900">
                  {selectedProfile.name}
                </h2>
                <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30 mt-1">Tycoon Operator</span>

                <div className="grid grid-cols-2 gap-4 w-full mt-10">
                  <div className="bg-gray-50 p-6 rounded-3xl border border-black/[0.03] flex flex-col items-center">
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-30 mb-2">Cash Balance</span>
                    <div className="flex flex-col items-center">
                       <span className="text-xl font-mono font-black text-green-600">${selectedProfile.balance.toLocaleString()}</span>
                       {(selectedProfile.debt || 0) > 0 && (
                         <div className="mt-2 flex items-center gap-1.5 px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full border border-rose-100">
                            <ShieldAlert className="w-2.5 h-2.5" />
                            <span className="text-[7px] font-black uppercase">-${(selectedProfile.debt || 0).toLocaleString()} Debt</span>
                         </div>
                       )}
                    </div>
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
                      const isMe = currentPlayer?.id === selectedProfile.id;
                      return (
                        <div key={prop.space_id} className={`p-4 rounded-2xl border ${prop.is_mortgaged ? 'bg-red-50 border-red-100 opacity-60' : 'bg-gray-50/50 border-black/[0.02]'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-6 rounded-full" style={{ backgroundColor: space.color || '#ccc' }} />
                              <div>
                                <div className="text-xs font-black uppercase tracking-tight">{space.name}</div>
                                {prop.is_mortgaged && <div className="text-[7px] font-bold text-red-500 uppercase tracking-widest">Hipotecada</div>}
                              </div>
                            </div>
                            <span className="text-[10px] font-mono opacity-40">${space.price}</span>
                          </div>
                          
                          {isMe && (
                            <div className="flex gap-2 mt-3">
                              <button 
                                onClick={() => sellProperty(prop.space_id)}
                                className="flex-1 py-2 bg-white border border-black/5 rounded-lg text-[8px] font-black uppercase hover:bg-red-50 hover:text-red-600 transition-all"
                              >
                                Vender (70%)
                              </button>
                              <button 
                                onClick={() => mortgageProperty(prop.space_id)}
                                className={`flex-1 py-2 border rounded-lg text-[8px] font-black uppercase transition-all ${prop.is_mortgaged ? 'bg-amber-100 border-amber-200 text-amber-700' : 'bg-white border-black/5 hover:bg-amber-50'}`}
                              >
                                {prop.is_mortgaged ? 'Levantar' : 'Embargar (50%)'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {properties.filter(p => p.owner_id === selectedProfile.id).length === 0 && (
                      <div className="text-center py-6 text-[10px] uppercase tracking-widest opacity-20 font-black italic">No assets acquired</div>
                    )}
                  </div>
                </div>

                <div className="w-full mt-4 space-y-4">
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-20 ml-2">Corporate Assets</div>
                  <div className="space-y-2 w-full">
                    {empresaList.filter(c => c.owner_id === selectedProfile.id).map(c => (
                      <div key={c.id} className="flex items-center justify-between p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
                         <div className="flex items-center gap-3">
                            <Building2 className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-black uppercase tracking-tight">{c.name}</span>
                         </div>
                         <span className="text-[9px] font-mono font-black text-blue-600">${c.base_price.toLocaleString()}</span>
                      </div>
                    ))}
                    {empresaList.filter(c => c.owner_id === selectedProfile.id).length === 0 && (
                      <div className="text-center py-4 text-[10px] uppercase tracking-widest opacity-10 font-black italic">No corporate holdings</div>
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
            
            <div 
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
            >
              {messages.map((m, idx) => (
                <div key={m.id || idx} className={cn("flex flex-col gap-1", m.player_id === currentPlayer?.id ? "items-end" : "items-start")}>
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[8px] font-black uppercase tracking-widest opacity-30">{m.player_name || 'Tycoon'}</span>
                    <span className="text-[7px] opacity-20 font-mono">
                      {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
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
        {isJoined && currentPlayer && !showSidebar && !showChat && (
          <motion.div 
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="fixed bottom-28 right-4 md:bottom-32 md:right-8 z-[90] flex flex-col items-center gap-4 pointer-events-auto"
          >
            <motion.div 
              animate={rolling ? { 
                scale: [1, 1.2, 1],
                y: [0, -10, 0]
              } : {}}
              transition={{ duration: 0.15, repeat: rolling ? Infinity : 0 }}
              className="w-32 h-20 md:w-40 md:h-24 bg-white border-2 border-black/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex flex-col items-center justify-center relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white to-blue-50/30 opacity-50" />
              <div className="flex gap-4 md:gap-6 items-center">
                {diceVisual.map((v, i) => (
                  <div key={i} className="relative z-10 flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-blue-600 text-white rounded-xl shadow-lg">
                    <span className="text-xl md:text-2xl font-black font-mono">{v}</span>
                  </div>
                ))}
              </div>
              {!rolling && (
                <div className="mt-2 text-[8px] font-black tracking-widest text-blue-600 opacity-40 uppercase">
                  Current Roll: {diceVisual[0] + diceVisual[1]}
                </div>
              )}
            </motion.div>

            {/* QUICK BUY BUTTON */}
            {isJoined && currentPlayer && !rolling && (
              (() => {
                const space = BOARD_SPACES[currentPlayer.position];
                const isOwned = properties.some(p => p.space_id === currentPlayer.position);
                const canBuy = (space.type === 'property' || space.type === 'railroad' || space.type === 'utility') && !isOwned;
                
                if (canBuy) {
                  return (
                    <motion.button
                      initial={{ scale: 0.8, opacity: 0, y: 20 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => buyProperty(currentPlayer.position)}
                      disabled={currentPlayer.balance < (space.price || 0)}
                      className="w-full py-4 bg-green-600 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl shadow-2xl flex items-center justify-center gap-3 border-4 border-white/20 hover:bg-black transition-all disabled:opacity-50 px-6"
                    >
                      <Building2 className="w-4 h-4" /> BUY PROPERTY · ${space.price}
                    </motion.button>
                  );
                }
                return null;
              })()
            )}

            <button 
              onClick={rollDice}
              disabled={rolling}
              className="group relative flex flex-col items-center justify-center w-20 h-20 md:w-28 md:h-28 bg-blue-600 hover:bg-black text-white rounded-[2rem] md:rounded-[2.5rem] shadow-[0_25px_60px_rgba(37,99,235,0.45)] transition-all active:scale-90 disabled:opacity-50 disabled:grayscale border-4 border-white/20"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
              {rolling ? (
                 <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">Rolling...</span>
              ) : (
                <>
                  <Zap className="w-8 h-8 md:w-10 md:h-10 mb-1 group-hover:rotate-12 transition-transform drop-shadow-lg" />
                  <span className="text-[9px] md:text-[11px] font-black tracking-widest leading-tight">MOVE</span>
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
              { id: 'casino', icon: Coins, label: 'Casino' },
              { id: 'transfer', icon: ArrowRightLeft, label: 'Trade' },
              { id: 'stats', icon: Users, label: 'Players' },
              { id: 'chat_history', icon: Send, label: 'Chat Log' }
            ].map(v => (
              <button 
                key={v.id}
                onClick={() => {
                  setView(v.id as any);
                  if (v.id !== 'board') {
                    setShowSidebar(true);
                  } else {
                    setShowSidebar(false);
                  }
                }}
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

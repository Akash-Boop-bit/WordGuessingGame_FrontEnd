import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GameState, 
  ClientToServerEvents, 
  ServerToClientEvents, 
  GameSettings,
  Player,
  ChatMessage 
} from './types';
import { 
  User, Users, Clock, Send, CheckCircle, 
  AlertTriangle, RefreshCw, Plus, Globe, 
  Key, Shield, Settings as SettingsIcon, Loader2, X, Check, MessageSquare,
  Volume2, VolumeX
} from 'lucide-react';

const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001');

// --- AUDIO UTILITIES ---
const sounds = {
  click: new Audio('/sounds/click.mp3'),
  vote: new Audio('/sounds/vote.mp3'),
  chat: new Audio('/sounds/chat.mp3'),
  start: new Audio('/sounds/start.mp3'),
  ambience: new Audio('/sounds/ambience.mp3'),
};

// Configure ambience
sounds.ambience.loop = true;
sounds.ambience.volume = 0.2;

const playSound = (sound: keyof typeof sounds, force = false) => {
  const isMuted = localStorage.getItem('muted') === 'true';
  if (isMuted && !force) return;
  
  const s = sounds[sound];
  s.currentTime = 0;
  s.play().catch(e => console.warn("Audio play blocked", e));
};

const DEFAULT_SETTINGS: GameSettings = {
  maxPlayers: 8,
  answeringTime: 30,
  revealTime: 10,
  discussionTime: 30,
  votingTime: 45
};

function Chat({ chatMessages, me, onClose }: { chatMessages: ChatMessage[], me?: Player, onClose: () => void }) {
  const [msg, setMsg] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (msg.trim()) {
      playSound('click');
      socket.emit('sendMessage', msg);
      setMsg('');
    }
  };

  return (
    <div className="flex flex-col h-full glass rounded-xl border border-white border-opacity-10 overflow-hidden shadow-2xl bg-space-900 bg-opacity-95 backdrop-blur-xl">
      <div className="flex justify-between items-center bg-space-900 bg-opacity-80 p-3 border-b border-white border-opacity-10">
        <div className="flex items-center gap-2 text-neon-cyan">
          <MessageSquare size={18} />
          <span className="font-bold uppercase tracking-widest text-sm">Crew Chat</span>
        </div>
        <button onClick={() => { playSound('click'); onClose(); }} className="p-1 hover:bg-white hover:bg-opacity-10 rounded-lg transition-colors text-white">
          <X size={20} />
        </button>
      </div>
      <div className="bg-neon-red bg-opacity-20 p-2 text-center border-b border-white border-opacity-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neon-red flex items-center justify-center gap-2">
          <AlertTriangle size={12} /> DO NOT LEAK YOUR QUESTION! Discuss answers only.
        </p>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {chatMessages.length === 0 && (
          <p className="text-center opacity-30 italic text-sm mt-10">Start the discussion...</p>
        )}
        {chatMessages.map(m => (
          <div key={m.id} className={`flex flex-col ${m.senderId === socket.id ? 'items-end' : 'items-start'}`}>
            <span className="text-[10px] opacity-50 mb-1 px-1" style={{ color: m.color }}>{m.senderName}</span>
            <div 
              className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                m.senderId === socket.id 
                ? 'bg-neon-cyan bg-opacity-20 rounded-tr-none' 
                : 'bg-white bg-opacity-5 rounded-tl-none border border-white border-opacity-5'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="p-3 border-t border-white border-opacity-5 bg-space-900 bg-opacity-50 flex gap-2">
        <input 
          type="text" 
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-white"
        />
        <button type="submit" className="text-neon-cyan hover:scale-110 transition-transform">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}

function DiscussionOrVotingScreen({ gameState, socket, me, canVote }: { gameState: GameState, socket: Socket<any, any>, me?: Player, canVote: boolean }) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const handleConfirmVote = () => {
    if (selectedTarget && canVote) {
      playSound('vote');
      socket.emit('submitVote', selectedTarget);
      setSelectedTarget(null);
    }
  };

  return (
    <motion.div key={canVote ? 'voting' : 'discussion'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col relative">
      <h2 className={`text-3xl font-bold text-center mb-12 uppercase italic tracking-tighter ${canVote ? 'text-neon-red' : 'text-neon-cyan'}`}>
        {canVote ? 'VOTE OUT THE IMPOSTER' : 'DISCUSS SUSPECTS'}
      </h2>
      
      {/* Voted indicators */}
      <div className="flex justify-center gap-2 mb-8">
        {gameState.players.map(p => (
          <div 
            key={p.id} 
            className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
              p.vote ? 'bg-green-500 border-green-300 scale-110' : 'bg-space-800 border-white border-opacity-10 opacity-30'
            }`}
            style={{ borderColor: p.vote ? undefined : p.avatarColor }}
          >
            <User size={20} className={p.vote ? 'text-white' : ''} style={{ color: p.vote ? undefined : p.avatarColor }} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {gameState.players.map(player => {
          const isSelected = selectedTarget === player.id;
          const hasVoted = !!me?.vote;
          const isMe = player.id === socket.id;

          return (
            <div
              key={player.id}
              className={`glass p-6 rounded-xl text-center transition-all flex flex-col items-center gap-4 relative overflow-hidden ${
                isSelected && canVote ? 'ring-4 ring-neon-cyan scale-105' : 'hover:bg-opacity-10'
              } ${isMe || hasVoted || !canVote ? 'opacity-50' : ''}`}
            >
              {/* Vote Confirmation Overlay */}
              <AnimatePresence>
                {isSelected && canVote && !hasVoted && (
                  <motion.div 
                    initial={{ y: 50 }}
                    animate={{ y: 0 }}
                    exit={{ y: 50 }}
                    className="absolute inset-0 bg-space-900 bg-opacity-90 flex items-center justify-around z-10 p-4"
                  >
                    <button 
                      onClick={(e) => { e.stopPropagation(); playSound('click'); setSelectedTarget(null); }}
                      className="p-3 bg-neon-red text-white rounded-full hover:scale-110 transition-transform"
                    >
                      <X size={32} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleConfirmVote(); }}
                      className="p-3 bg-green-500 text-white rounded-full hover:scale-110 transition-transform"
                    >
                      <Check size={32} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                disabled={hasVoted || isMe || !canVote}
                onClick={() => { if (canVote) { playSound('click'); setSelectedTarget(player.id); } }}
                className={`w-full flex flex-col items-center gap-4 ${!canVote ? 'cursor-default' : ''}`}
              >
                <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: player.avatarColor }}>
                  <User size={32} />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold">{player.name}</span>
                  <span className="text-[10px] opacity-50 uppercase tracking-widest">{player.answer}</span>
                </div>
                
                {me?.vote === player.id && (
                  <div className="flex items-center gap-2 text-green-500 font-bold text-xs uppercase">
                    <CheckCircle size={14} /> Voted
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Floating Chat Button */}
      <div className="fixed bottom-8 right-8 z-20">
        <button 
          onClick={() => { playSound('click'); setIsChatOpen(true); }}
          className="bg-neon-cyan text-space-900 p-4 rounded-full shadow-glow glow-cyan hover:scale-110 transition-all relative"
        >
          <MessageSquare size={32} />
          {gameState.chatMessages.length > 0 && !isChatOpen && (
            <span className="absolute -top-1 -right-1 bg-neon-red text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-space-900">
              !
            </span>
          )}
        </button>
      </div>

      {/* Chat Overlay */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full max-w-md z-30 p-4"
          >
            <Chat 
              chatMessages={gameState.chatMessages} 
              me={me} 
              onClose={() => setIsChatOpen(false)} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function App() {
  const [view, setView] = useState<'name' | 'landing' | 'settings' | 'game'>('name');
  const [isBackendAwake, setIsBackendAwake] = useState(false);
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [isMuted, setIsMuted] = useState(() => localStorage.getItem('muted') === 'true');

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
        const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const res = await fetch(`${cleanUrl}/health`);
        if (res.ok) {
          setIsBackendAwake(true);
        }
      } catch (e) {
        // Silently fail, it's expected during cold start
      }
    };

    if (!isBackendAwake) {
      checkBackend();
      const interval = setInterval(checkBackend, 3000);
      return () => clearInterval(interval);
    }
  }, [isBackendAwake]);

  useEffect(() => {
    socket.on('gameStateUpdate', (state) => {
      // Trigger start sound if transition to loading
      if (gameState?.phase === 'lobby' && state.phase === 'loading') {
        playSound('start');
      }
      setGameState(state);
      if (view !== 'game') setView('game');
    });

    socket.on('error', (msg) => {
      setError(msg);
      setTimeout(() => setError(null), 3000);
    });

    return () => {
      socket.off('gameStateUpdate');
      socket.off('error');
    };
  }, [view, gameState]);

  // Handle Chat Sound
  const lastChatId = useRef<string | null>(null);
  useEffect(() => {
    if (gameState?.chatMessages.length) {
      const latestMsg = gameState.chatMessages[gameState.chatMessages.length - 1];
      if (latestMsg.id !== lastChatId.current) {
        if (latestMsg.senderId !== socket.id) {
          playSound('chat');
        }
        lastChatId.current = latestMsg.id;
      }
    }
  }, [gameState?.chatMessages]);

  // Handle Ambience
  useEffect(() => {
    if (!isMuted) {
      sounds.ambience.play().catch(() => {});
    } else {
      sounds.ambience.pause();
    }
  }, [isMuted]);

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    localStorage.setItem('muted', String(nextMuted));
    playSound('click', true);
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      playSound('click');
      setView('landing');
    }
  };

  const hostGame = () => {
    playSound('click');
    setView('settings');
  };
  
  const createRoom = () => {
    playSound('click');
    socket.emit('createRoom', name, settings);
  };

  const joinGame = (code?: string) => {
    playSound('click');
    socket.emit('joinRoom', name, code);
  };

  const updateSettings = (newSettings: GameSettings) => {
    setSettings(newSettings);
    if (gameState?.players.find(p => p.id === socket.id)?.isHost) {
      socket.emit('updateSettings', newSettings);
    }
  };

  const me = gameState?.players.find(p => p.id === socket.id);

  // --- RENDERING HELPERS ---

  if (!isBackendAwake) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-stars overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center text-center max-w-md"
        >
          <div className="relative mb-12">
            <motion.div 
              animate={{ 
                rotate: 360,
                scale: [1, 1.1, 1],
              }}
              transition={{ 
                rotate: { duration: 8, repeat: Infinity, ease: "linear" },
                scale: { duration: 4, repeat: Infinity, ease: "easeInOut" }
              }}
              className="w-32 h-32 rounded-full border-4 border-dashed border-neon-cyan border-opacity-30"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-12 h-12 text-neon-cyan animate-spin" />
            </div>
            
            {/* Pulsing glow effect */}
            <motion.div 
              animate={{ opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -inset-4 bg-neon-cyan rounded-full blur-2xl -z-10"
            />
          </div>

          <h1 className="text-3xl font-black uppercase italic tracking-tighter mb-4 text-white">
            Waking Up <span className="text-neon-cyan">Game Server</span>
          </h1>
          
          <div className="space-y-4">
            <p className="text-white opacity-60 text-sm leading-relaxed">
              We're using a free tier server which goes to sleep after inactivity. 
              This usually takes <span className="text-neon-cyan font-bold">1-2 minutes</span> to spin back up.
            </p>
            
            <div className="glass p-4 rounded-xl border border-white border-opacity-10">
              <p className="text-[10px] uppercase tracking-[0.2em] text-neon-cyan font-bold mb-2">Pro Tip</p>
              <p className="text-xs text-white opacity-40">
                While you wait, think of some tricky one-word answers to throw off the crew!
              </p>
            </div>
            
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 60, ease: "linear" }}
              className="h-1 bg-neon-cyan bg-opacity-20 rounded-full overflow-hidden"
            >
              <motion.div className="h-full bg-neon-cyan shadow-glow glow-cyan" />
            </motion.div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (view === 'name') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-stars">
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="glass p-8 rounded-2xl w-full max-md glow-cyan text-center relative"
        >
          <button onClick={toggleMute} className="absolute top-4 right-4 p-2 hover:bg-white hover:bg-opacity-10 rounded-full transition-all text-white">
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <h1 className="text-4xl font-bold mb-8 text-neon-cyan tracking-tighter uppercase italic">
            Imposter Word Game
          </h1>
          <form onSubmit={handleNameSubmit} className="space-y-6">
            <div className="text-left">
              <label className="block text-sm font-medium mb-2 opacity-70">Pilot Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-space-800 border border-white border-opacity-20 rounded-lg p-3 focus:outline-none focus:border-neon-cyan transition-colors text-white"
                placeholder="Enter your name..."
                maxLength={12}
                autoFocus
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-neon-cyan text-space-900 font-bold py-3 rounded-lg hover:scale-105 transition-all uppercase tracking-widest"
            >
              Continue
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  if (view === 'landing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-stars">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass p-8 rounded-2xl w-full max-w-md glow-cyan space-y-4 relative"
        >
          <button onClick={toggleMute} className="absolute top-4 right-4 p-2 hover:bg-white hover:bg-opacity-10 rounded-full transition-all text-neon-cyan">
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <div className="text-center mb-8">
            <p className="opacity-50 uppercase text-xs tracking-widest mb-1">Welcome, Pilot</p>
            <h2 className="text-2xl font-bold text-neon-cyan uppercase">{name}</h2>
          </div>

          <button 
            onClick={hostGame}
            className="w-full flex items-center justify-between bg-white bg-opacity-5 hover:bg-opacity-10 p-4 rounded-xl border border-white border-opacity-10 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-neon-cyan bg-opacity-20 rounded-lg text-neon-cyan">
                <Plus />
              </div>
              <div className="text-left text-white">
                <p className="font-bold uppercase tracking-tight">Host Game</p>
                <p className="text-xs opacity-50">Create a private lobby</p>
              </div>
            </div>
          </button>

          <button 
            onClick={() => joinGame()}
            className="w-full flex items-center justify-between bg-white bg-opacity-5 hover:bg-opacity-10 p-4 rounded-xl border border-white border-opacity-10 transition-all group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500 bg-opacity-20 rounded-lg text-green-500">
                <Globe />
              </div>
              <div className="text-left text-white">
                <p className="font-bold uppercase tracking-tight">Join Public</p>
                <p className="text-xs opacity-50">Quick play with strangers</p>
              </div>
            </div>
          </button>

          <div className="pt-4 border-t border-white border-opacity-10">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ENTER CODE"
                className="flex-1 bg-space-800 border border-white border-opacity-20 rounded-lg p-3 focus:outline-none focus:border-neon-cyan text-center font-mono tracking-widest text-white"
                maxLength={6}
              />
              <button 
                onClick={() => joinGame(roomCode)}
                className="bg-neon-cyan text-space-900 px-6 font-bold rounded-lg hover:bg-opacity-80 transition-all"
              >
                JOIN
              </button>
            </div>
          </div>
          {error && <p className="text-neon-red text-center text-sm animate-pulse">{error}</p>}
        </motion.div>
      </div>
    );
  }

  if (view === 'settings') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-stars">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass p-8 rounded-2xl w-full max-w-2xl glow-cyan"
        >
          <div className="flex items-center gap-3 mb-8">
            <SettingsIcon className="text-neon-cyan" />
            <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">Mission Configuration</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="space-y-6">
              <div>
                <label className="flex justify-between text-sm uppercase mb-2 opacity-70 text-white">
                  Max Players <span>{settings.maxPlayers}</span>
                </label>
                <input 
                  type="range" min="4" max="10" 
                  value={settings.maxPlayers} 
                  onChange={(e) => { playSound('click'); updateSettings({...settings, maxPlayers: parseInt(e.target.value)}); }}
                  className="w-full accent-neon-cyan"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm uppercase mb-2 opacity-70 text-white">
                  Answering Time <span>{settings.answeringTime}s</span>
                </label>
                <input 
                  type="range" min="15" max="120" step="5"
                  value={settings.answeringTime} 
                  onChange={(e) => { playSound('click'); updateSettings({...settings, answeringTime: parseInt(e.target.value)}); }}
                  className="w-full accent-neon-cyan"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm uppercase mb-2 opacity-70 text-white">
                  Discussion Time <span>{settings.discussionTime}s</span>
                </label>
                <input 
                  type="range" min="0" max="120" step="5"
                  value={settings.discussionTime} 
                  onChange={(e) => { playSound('click'); updateSettings({...settings, discussionTime: parseInt(e.target.value)}); }}
                  className="w-full accent-neon-cyan"
                />
              </div>
            </div>
            <div className="space-y-6">
              <div>
                <label className="flex justify-between text-sm uppercase mb-2 opacity-70 text-white">
                  Reveal Time <span>{settings.revealTime}s</span>
                </label>
                <input 
                  type="range" min="5" max="60" step="5"
                  value={settings.revealTime} 
                  onChange={(e) => { playSound('click'); updateSettings({...settings, revealTime: parseInt(e.target.value)}); }}
                  className="w-full accent-neon-cyan"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm uppercase mb-2 opacity-70 text-white">
                  Voting Time <span>{settings.votingTime}s</span>
                </label>
                <input 
                  type="range" min="15" max="120" step="5"
                  value={settings.votingTime} 
                  onChange={(e) => { playSound('click'); updateSettings({...settings, votingTime: parseInt(e.target.value)}); }}
                  className="w-full accent-neon-cyan"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => { playSound('click'); setView('landing'); }}
              className="flex-1 border border-white border-opacity-20 py-4 rounded-xl font-bold uppercase hover:bg-white hover:bg-opacity-5 transition-all text-white"
            >
              Back
            </button>
            <button 
              onClick={createRoom}
              className="flex-[2] bg-neon-cyan text-space-900 py-4 rounded-xl font-bold uppercase tracking-widest glow-cyan hover:scale-105 transition-all"
            >
              Launch Lobby
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!gameState) return <div className="flex items-center justify-center min-h-screen text-white">Connecting...</div>;

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto flex flex-col bg-stars relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 glass p-4 rounded-xl border border-white border-opacity-10">
        <div className="flex items-center gap-4">
          <button onClick={toggleMute} className="p-2 hover:bg-white hover:bg-opacity-10 rounded-lg transition-all text-neon-cyan">
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <div className="flex items-center gap-2">
            <Clock className="text-neon-cyan" />
            <span className="text-2xl font-mono text-white">{gameState.timer}s</span>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-space-800 px-3 py-1 rounded-lg border border-white border-opacity-5">
            <Key size={14} className="text-neon-cyan" />
            <span className="font-mono text-sm tracking-tighter uppercase text-white">{gameState.roomId}</span>
          </div>
        </div>
        <div className="text-sm opacity-50 uppercase tracking-widest font-bold hidden sm:block text-white">
          Phase: {gameState.phase}
        </div>
        <div className="flex items-center gap-2 text-white">
          <Users className="text-neon-cyan" />
          <span>{gameState.players.length}/{gameState.settings.maxPlayers}</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {gameState.phase === 'lobby' && (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {gameState.players.map(player => (
                <div key={player.id} className="glass p-4 rounded-xl flex items-center justify-between border-l-4" style={{ borderColor: player.avatarColor }}>
                  <div className="flex items-center gap-3 text-white">
                    <User style={{ color: player.avatarColor }} />
                    <div className="flex flex-col">
                      <span className="font-bold flex items-center gap-2">
                        {player.name} {player.id === socket.id && "(You)"}
                        {player.isHost && <Shield size={12} className="text-neon-cyan" />}
                      </span>
                    </div>
                  </div>
                  {player.isReady ? <CheckCircle className="text-green-500 w-5 h-5" /> : <div className="w-5 h-5 rounded-full border border-white opacity-20" />}
                </div>
              ))}
            </div>
            
            <div className="mt-auto flex flex-col items-center gap-6">
              <div className="flex gap-4">
                <button 
                  onClick={() => { playSound('click'); socket.emit('toggleReady'); }}
                  className={`px-12 py-4 rounded-full font-bold text-xl transition-all ${
                    me?.isReady ? 'bg-green-500 text-white' : 'bg-neon-cyan text-space-900 glow-cyan'
                  }`}
                >
                  {me?.isReady ? 'READY!' : 'READY UP'}
                </button>
              </div>
              <p className="text-center opacity-50 italic text-white">
                {gameState.players.length < 4 
                  ? 'Waiting for at least 4 players...' 
                  : 'Waiting for all crewmates to ready up...'}
              </p>
            </div>
          </motion.div>
        )}

        {gameState.phase === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-20 h-20 text-neon-cyan animate-spin mb-8" />
            <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-4 text-neon-cyan animate-pulse">
              Consulting AI Game Master
            </h2>
            <p className="opacity-50 text-xl max-w-md text-white">
              Synchronizing neural pathways and generating mission parameters...
            </p>
          </motion.div>
        )}

        {gameState.phase === 'answering' && (
          <motion.div key="answering" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto text-center">
            <h2 className="text-2xl mb-2 opacity-50 uppercase tracking-widest text-white">Theme: {gameState.currentTheme?.theme}</h2>
            <p className="text-3xl font-bold mb-12 text-white">
              {me?.role === 'imposter' ? gameState.currentTheme?.imposterQuestion : gameState.currentTheme?.innocentQuestion}
            </p>

            {me?.answer ? (
              <div className="glass p-8 rounded-2xl glow-cyan text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-xl text-white">Answer Transmitted: <span className="text-neon-cyan font-bold uppercase tracking-widest">{me.answer}</span></p>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); if (answer.trim()) { playSound('click'); socket.emit('submitAnswer', answer); setAnswer(''); } }} className="w-full flex gap-2">
                <input 
                  autoFocus type="text" value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="flex-1 bg-space-800 border border-white border-opacity-20 rounded-lg p-4 text-xl focus:outline-none focus:border-neon-cyan text-white"
                  placeholder="Your one-word answer..."
                />
                <button className="bg-neon-cyan text-space-900 p-4 rounded-lg"><Send /></button>
              </form>
            )}
          </motion.div>
        )}

        {gameState.phase === 'reveal' && (
          <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              {gameState.players.map(player => (
                <div key={player.id} className="glass p-6 rounded-xl text-center border-t-4" style={{ borderColor: player.avatarColor }}>
                  <p className="text-sm opacity-50 mb-2 uppercase tracking-tighter text-white">{player.name}</p>
                  <p className="text-2xl font-bold uppercase text-neon-cyan tracking-wider">{player.answer || '???'}</p>
                </div>
              ))}
            </div>
            <div className="text-center mt-auto">
              <p className="text-xl font-bold text-neon-red animate-pulse uppercase tracking-widest">
                {gameState.settings.discussionTime > 0 ? 'Discussion' : 'Voting'} begins in {gameState.timer}s
              </p>
            </div>
          </motion.div>
        )}

        {(gameState.phase === 'discussion' || gameState.phase === 'voting') && (
          <DiscussionOrVotingScreen 
            gameState={gameState} 
            socket={socket} 
            me={me} 
            canVote={gameState.phase === 'voting'} 
          />
        )}

        {gameState.phase === 'results' && (
          <motion.div key="results" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex-1 flex flex-col items-center justify-center text-center">
            <div className={`text-6xl font-black mb-8 uppercase italic tracking-tighter ${
              gameState.winner === 'innocent' ? 'text-green-500' : 'text-neon-red'
            }`}>
              {gameState.winner === 'innocent' ? 'Imposter Defeated' : 'Imposter Won'}
            </div>

            <div className="glass p-8 rounded-2xl max-w-lg w-full mb-12 border border-white border-opacity-10 text-white">
              {gameState.votedOutPlayerId ? (
                <p className="text-xl mb-4">
                  <span className="font-bold text-neon-cyan">
                    {gameState.players.find(p => p.id === gameState.votedOutPlayerId)?.name}
                  </span> was voted out.
                </p>
              ) : (
                <p className="text-xl mb-4">No one was voted out.</p>
              )}
              
              <div className="space-y-4 pt-4 border-t border-white border-opacity-5">
                <div className="flex justify-between">
                  <span className="opacity-50">Theme:</span>
                  <span className="font-bold text-neon-cyan uppercase">{gameState.currentTheme?.theme}</span>
                </div>
                <div className="pt-4 border-t border-white border-opacity-5">
                  <p className="text-xs opacity-50 uppercase mb-2">The Imposter Was</p>
                  <p className="text-3xl font-bold text-neon-red uppercase italic tracking-widest">
                    {gameState.players.find(p => p.role === 'imposter')?.name}
                  </p>
                </div>
              </div>
            </div>

            {me?.isHost ? (
              <button 
                onClick={() => { playSound('click'); socket.emit('playAgain'); }}
                className="flex items-center gap-2 bg-neon-cyan text-space-900 px-8 py-3 rounded-full font-bold hover:scale-110 transition-transform glow-cyan"
              >
                <RefreshCw size={20} />
                PLAY AGAIN
              </button>
            ) : (
              <p className="text-neon-cyan animate-pulse font-bold uppercase tracking-widest italic">
                Waiting for the host to restart...
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

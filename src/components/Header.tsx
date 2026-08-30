import React, { useEffect, useState } from 'react';
import { Bot, Clock, Radio, Shield, Sparkles } from 'lucide-react';
import { STUDIO_CREDIT } from '../utils/formatter';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isPolling: boolean;
  onTogglePolling: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, isPolling, onTogglePolling }) => {
  const [istTime, setIstTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const formatter = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      setIstTime(formatter.format(new Date()));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'animes', label: 'My Animes' },
    { id: 'post_studio', label: 'Post Studio' },
    { id: 'schedules', label: 'Scheduled Posts' },
    { id: 'channels', label: 'Channels' },
    { id: 'history', label: 'Posting History' },
    { id: 'simulator', label: 'Telegram Bot Emulator' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-stone-900/95 backdrop-blur border-b border-stone-800 text-stone-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold tracking-tight text-white">
                  Anime Poster & Episode CMS
                </h1>
                <span className="text-[11px] font-medium bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
                  v2.0 Enhanced
                </span>
              </div>
              <p className="text-xs text-stone-400 font-mono">
                {STUDIO_CREDIT}
              </p>
            </div>
          </div>

          {/* System Status & Time */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-800/80 border border-stone-700/60 text-xs font-mono text-stone-300">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{istTime || '--:--:--'} IST</span>
            </div>

            <button
              onClick={onTogglePolling}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                isPolling
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/40'
                  : 'bg-stone-800 border-stone-700 text-stone-400 hover:bg-stone-750'
              }`}
              title="Click to toggle Telegram Bot polling loop"
            >
              <Radio className={`w-3.5 h-3.5 ${isPolling ? 'animate-pulse text-emerald-400' : 'text-stone-500'}`} />
              <span className="hidden md:inline">{isPolling ? 'Polling: Active' : 'Polling: Standby'}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 overflow-x-auto scrollbar-none py-1 border-t border-stone-800/60">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3.5 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-stone-950 font-semibold shadow-sm'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

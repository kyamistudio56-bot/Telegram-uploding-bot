import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, User, Sparkles, RefreshCw, Smartphone } from 'lucide-react';
import { STUDIO_CREDIT } from '../utils/formatter';
import { apiService } from '../services/api';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text?: string;
  photo?: string;
  reply_markup?: {
    inline_keyboard?: Array<Array<{ text: string; callback_data?: string; url?: string }>>;
  };
  time: string;
}

export const TelegramSimulatorView: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [userId, setUserId] = useState('724118793');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initial /start on mount if empty
  useEffect(() => {
    if (messages.length === 0) {
      handleSendMessage('/start');
    }
  }, []);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `USR_${Date.now()}`,
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setIsLoading(true);

    try {
      const data = await apiService.simulateTelegram({ userId, text });
      if (data.messages && Array.isArray(data.messages)) {
        const botMessages: ChatMessage[] = data.messages.map((m: any, idx: number) => ({
          id: `BOT_${Date.now()}_${idx}`,
          sender: 'bot',
          text: m.text,
          photo: m.photo,
          reply_markup: m.reply_markup,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }));
        setMessages((prev) => [...prev, ...botMessages]);
      }
    } catch (err: any) {
      console.warn('Simulator sync notice:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallbackClick = async (callbackData?: string, url?: string) => {
    if (url) {
      window.open(url, '_blank');
      return;
    }
    if (!callbackData) return;

    const userClickMsg: ChatMessage = {
      id: `USR_CB_${Date.now()}`,
      sender: 'user',
      text: `[Pressed: ${callbackData}]`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userClickMsg]);
    setIsLoading(true);

    try {
      const data = await apiService.simulateTelegram({ userId, callback_data: callbackData });
      if (data.messages && Array.isArray(data.messages)) {
        const botMessages: ChatMessage[] = data.messages.map((m: any, idx: number) => ({
          id: `BOT_${Date.now()}_${idx}`,
          sender: 'bot',
          text: m.text,
          photo: m.photo,
          reply_markup: m.reply_markup,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }));
        setMessages((prev) => [...prev, ...botMessages]);
      }
    } catch (err) {
      console.warn('Callback notice:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Telegram Bot Interactive Emulator</h2>
          <p className="text-xs text-stone-400">
            Real-time interactive session tester for multi-step flows, anime registrations, and callbacks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-xs">
            <span className="text-stone-400">Simulated User ID:</span>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="bg-transparent text-amber-400 font-mono font-bold focus:outline-none w-24"
            />
          </div>

          <button
            onClick={() => {
              setMessages([]);
              handleSendMessage('/start');
            }}
            className="p-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-400 hover:text-white transition-colors"
            title="Reset Chat Session"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Simulator Device Frame */}
      <div className="max-w-2xl mx-auto rounded-3xl bg-stone-950 border-4 border-stone-800 shadow-2xl overflow-hidden flex flex-col h-[650px]">
        {/* Telegram Chat Header */}
        <div className="bg-[#1f2936] px-4 py-3 border-b border-stone-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Anime Poster & CMS Bot</h3>
              <p className="text-[10px] text-stone-400 font-mono">bot • {STUDIO_CREDIT}</p>
            </div>
          </div>
          <div className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
            Online
          </div>
        </div>

        {/* Telegram Chat Message Stream */}
        <div className="flex-1 bg-[#0f141c] p-4 overflow-y-auto space-y-4 scrollbar-thin">
          {messages.map((msg) => {
            const isBot = msg.sender === 'bot';
            return (
              <div key={msg.id} className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 space-y-2.5 shadow-md ${
                    isBot
                      ? 'bg-[#1e2733] border border-[#2b3748] text-stone-100'
                      : 'bg-amber-500 text-stone-950 font-medium'
                  }`}
                >
                  {/* Photo if present */}
                  {msg.photo && (
                    <div className="rounded-xl overflow-hidden aspect-[4/3] bg-black/40">
                      <img
                        src={msg.photo}
                        alt="Bot media"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  {/* Text */}
                  {msg.text && (
                    <div
                      className={`text-xs whitespace-pre-wrap leading-relaxed ${
                        isBot ? 'font-mono text-stone-200' : 'font-sans font-medium'
                      }`}
                    >
                      {msg.text}
                    </div>
                  )}

                  {/* Inline Keyboard */}
                  {msg.reply_markup?.inline_keyboard && (
                    <div className="space-y-1.5 pt-1">
                      {msg.reply_markup.inline_keyboard.map((row, rIdx) => (
                        <div key={rIdx} className="flex gap-1.5">
                          {row.map((btn, bIdx) => (
                            <button
                              key={bIdx}
                              onClick={() => handleCallbackClick(btn.callback_data, btn.url)}
                              className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#2b3a4e] hover:bg-[#384c66] text-white text-[11px] font-mono font-semibold transition-colors truncate border border-[#3b4e68] text-center"
                            >
                              {btn.text}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}

                  <div
                    className={`text-[9px] text-right font-mono ${
                      isBot ? 'text-stone-400' : 'text-stone-800'
                    }`}
                  >
                    {msg.time}
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl p-3 bg-[#1e2733] border border-[#2b3748] text-stone-400 text-xs flex items-center gap-2 font-mono">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Bot is typing...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Command Suggestions */}
        <div className="bg-[#18202a] px-4 py-2 border-t border-stone-800 flex gap-2 overflow-x-auto scrollbar-none text-xs">
          {['/start', '➕ Add Anime', '📚 My Animes', '📤 Post Episode', '📅 Scheduled Posts', '⚙️ Settings'].map(
            (cmd) => (
              <button
                key={cmd}
                onClick={() => handleSendMessage(cmd)}
                className="px-2.5 py-1 rounded-lg bg-[#222d3b] hover:bg-[#2c3a4c] text-stone-300 text-[11px] font-mono whitespace-nowrap border border-stone-700 transition-colors"
              >
                {cmd}
              </button>
            )
          )}
        </div>

        {/* Input Bar */}
        <div className="bg-[#1f2936] p-3 border-t border-stone-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Type command or message (e.g. /start, text, URL)..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 px-4 py-2 bg-[#121922] border border-stone-700 rounded-xl text-stone-100 text-xs focus:outline-none focus:border-amber-500 placeholder-stone-500"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { BotSettings } from '../types';
import { Shield, Key, Users, Clock, Radio, Send, CheckCircle2, AlertCircle, Eye, EyeOff, Save } from 'lucide-react';
import { STUDIO_CREDIT } from '../utils/formatter';

interface SettingsViewProps {
  settings: BotSettings;
  onUpdateSettings: (newSettings: Partial<BotSettings>) => Promise<void>;
  onTogglePolling: () => Promise<void>;
  onBroadcast: (message: string) => Promise<{ sent: number; failed: number }>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onTogglePolling,
  onBroadcast,
}) => {
  const [tokenInput, setTokenInput] = useState(settings.bot_token || '');
  const [showToken, setShowToken] = useState(false);
  const [ownerIdsInput, setOwnerIdsInput] = useState((settings.bot_owner_ids || []).join(', '));
  const [timezoneInput, setTimezoneInput] = useState(settings.default_timezone || 'Asia/Kolkata');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const parsedOwners = ownerIdsInput
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      await onUpdateSettings({
        bot_token: tokenInput.trim(),
        bot_owner_ids: parsedOwners,
        default_timezone: timezoneInput.trim() || 'Asia/Kolkata',
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;
    try {
      const res = await onBroadcast(broadcastMsg);
      setBroadcastResult(`Broadcast dispatched: ${res.sent} sent, ${res.failed} failed.`);
      setBroadcastMsg('');
    } catch (err: any) {
      setBroadcastResult(`Broadcast failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">System Settings & Bot Authentication</h2>
        <p className="text-xs text-stone-400">
          Manage multi-owner access, Telegram bot token, background polling, and broadcast tools.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Settings saved and updated successfully.</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-5">
        {/* Telegram Bot Token */}
        <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Telegram Bot Token</h3>
          </div>
          <p className="text-xs text-stone-400">
            Obtained from <code>@BotFather</code> on Telegram. Used for polling updates and sending channel messages.
          </p>

          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="e.g. 7123456789:AAEj4b..."
              className="w-full px-3.5 py-2.5 bg-stone-850 border border-stone-700 rounded-xl text-stone-100 font-mono text-xs focus:outline-none focus:border-amber-500 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white"
            >
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Multi-Owner IDs */}
        <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Multi-User Owner IDs</h3>
          </div>
          <p className="text-xs text-stone-400">
            Comma-separated list of Telegram numeric User IDs permitted to use the bot and CMS features.
          </p>

          <input
            type="text"
            value={ownerIdsInput}
            onChange={(e) => setOwnerIdsInput(e.target.value)}
            placeholder="724118793, 123456789, 987654321"
            className="w-full px-3.5 py-2.5 bg-stone-850 border border-stone-700 rounded-xl text-stone-100 font-mono text-xs focus:outline-none focus:border-cyan-400"
          />
          <div className="text-[11px] text-stone-500">
            Users matching these IDs will have full access to interactive menus and commands.
          </div>
        </div>

        {/* Timezone & Scheduler */}
        <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Default Timezone</h3>
          </div>
          <p className="text-xs text-stone-400">
            All schedules and live previews evaluate in this standard timezone.
          </p>

          <input
            type="text"
            value={timezoneInput}
            onChange={(e) => setTimezoneInput(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-stone-850 border border-stone-700 rounded-xl text-stone-100 font-mono text-xs focus:outline-none focus:border-emerald-400"
          />
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-xl transition-all shadow-md"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>

      {/* Background Polling Control */}
      <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Telegram Long-Polling Worker</h3>
            </div>
            <p className="text-xs text-stone-400">
              Starts/stops the background polling worker for real-time Telegram interaction.
            </p>
          </div>

          <button
            onClick={onTogglePolling}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
              settings.is_polling
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30 hover:bg-emerald-900/60'
                : 'bg-stone-800 text-stone-400 border-stone-700 hover:bg-stone-750'
            }`}
          >
            {settings.is_polling ? 'Active (Running)' : 'Standby (Stopped)'}
          </button>
        </div>
      </div>

      {/* Broadcast Announcement Tool */}
      <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-bold text-white">Broadcast Announcement to All Channels</h3>
        </div>
        <p className="text-xs text-stone-400">
          Dispatches a text message announcement directly across all enabled Telegram channels.
        </p>

        {broadcastResult && (
          <div className="p-3 bg-stone-850 rounded-xl border border-stone-750 text-xs text-stone-200 font-mono">
            {broadcastResult}
          </div>
        )}

        <form onSubmit={handleSendBroadcast} className="space-y-3 text-xs">
          <textarea
            rows={3}
            value={broadcastMsg}
            onChange={(e) => setBroadcastMsg(e.target.value)}
            placeholder="Type channel announcement..."
            className="w-full px-3.5 py-2.5 bg-stone-850 border border-stone-700 rounded-xl text-stone-100 font-mono text-xs focus:outline-none focus:border-purple-400"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!broadcastMsg.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl transition-colors"
            >
              Dispatch Broadcast
            </button>
          </div>
        </form>
      </div>

      {/* Studio Credit */}
      <div className="p-4 rounded-2xl bg-stone-900/60 border border-stone-800 text-center space-y-1">
        <span className="text-xs font-semibold text-stone-400">Permanent Developer & Studio Credit</span>
        <div className="text-sm font-bold text-amber-400 font-mono">{STUDIO_CREDIT}</div>
      </div>
    </div>
  );
};

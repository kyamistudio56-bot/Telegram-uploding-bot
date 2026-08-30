import React, { useState } from 'react';
import { Channel, ChannelButton } from '../types';
import { Radio, Plus, CheckCircle2, AlertCircle, Edit3, Trash2, ShieldCheck, ShieldAlert, X, ExternalLink } from 'lucide-react';

interface ChannelsViewProps {
  channels: Channel[];
  onCreateChannel: (data: { name: string; channel_id: string; buttons_row2: ChannelButton[] }) => Promise<void>;
  onUpdateChannel: (id: string, data: Partial<Channel>) => Promise<void>;
  onDeleteChannel: (id: string) => Promise<void>;
  onTestPermissions: (channelId: string) => Promise<{
    success: boolean;
    message: string;
    details?: string;
    chatTitle?: string;
    resolvedChatId?: string | number;
  }>;
}

export const ChannelsView: React.FC<ChannelsViewProps> = ({
  channels,
  onCreateChannel,
  onUpdateChannel,
  onDeleteChannel,
  onTestPermissions,
}) => {
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    success: boolean;
    message: string;
    details?: string;
    chatTitle?: string;
    resolvedChatId?: string | number;
  } | null>(null);

  // Edit / Add Modal
  const [showModal, setShowModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [name, setName] = useState('');
  const [channelIdInput, setChannelIdInput] = useState('');
  const [row2Buttons, setRow2Buttons] = useState<ChannelButton[]>([
    { text: '◱ 𝙉𝙚𝙩𝙬𝙤𝙧𝙠 ◰', url: 'https://t.me/Anime_Network_Official' },
    { text: '◱ 𝙈𝙖𝙞𝙣 𝘾𝙝𝙖𝙣𝙣𝙚𝙡 ◰', url: 'https://t.me/Main_Anime_Channel' },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenAdd = () => {
    setEditingChannel(null);
    setName(`Channel ${channels.length + 1}`);
    setChannelIdInput(`@Anime_Channel_${channels.length + 1}`);
    setRow2Buttons([
      { text: '◱ 𝙈𝘼𝙄𝙉 𝘾𝙃𝘼𝙉𝙉𝙀𝙇 ◰', url: 'https://t.me/Main_Anime_Channel' },
      { text: '◱ 𝙏𝙐𝙏𝙊𝙍𝙄𝘼𝙇 ◰', url: 'https://t.me/Tutorial_Channel' },
    ]);
    setShowModal(true);
  };

  const handleOpenEdit = (ch: Channel) => {
    setEditingChannel(ch);
    setName(ch.name);
    setChannelIdInput(ch.channel_id);
    setRow2Buttons(ch.buttons_row2 || []);
    setShowModal(true);
  };

  const handleSaveChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !channelIdInput) return;
    setIsSubmitting(true);
    try {
      if (editingChannel) {
        await onUpdateChannel(editingChannel.id, {
          name,
          channel_id: channelIdInput,
          buttons_row2: row2Buttons,
        });
      } else {
        await onCreateChannel({
          name,
          channel_id: channelIdInput,
          buttons_row2: row2Buttons,
        });
      }
      setShowModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestChannel = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await onTestPermissions(id);
      setTestResult({
        id,
        success: res.success,
        message: res.message,
        details: res.details,
        chatTitle: res.chatTitle,
        resolvedChatId: res.resolvedChatId,
      });
    } catch (err: any) {
      setTestResult({ id, success: false, message: err.message || 'Verification failed' });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Channel Configuration & Buttons</h2>
          <p className="text-xs text-stone-400">
            Independent channel IDs, posting permissions, and customizable Row 2 buttons.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs rounded-xl transition-all shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Channel</span>
        </button>
      </div>

      {/* Channel Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {channels.map((ch, idx) => (
          <div
            key={ch.id}
            className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Radio className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{ch.name}</h3>
                    <p className="text-[11px] font-mono text-stone-400">{ch.channel_id}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onUpdateChannel(ch.id, { is_enabled: !ch.is_enabled })}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                      ch.is_enabled
                        ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30'
                        : 'bg-stone-800 text-stone-500 border-stone-700'
                    }`}
                  >
                    {ch.is_enabled ? 'Active' : 'Disabled'}
                  </button>
                </div>
              </div>

              {/* Row 2 Buttons Preview */}
              <div className="p-3 bg-stone-850 rounded-xl border border-stone-750 space-y-2">
                <span className="text-[10px] uppercase font-mono tracking-wider text-stone-400">
                  Configured Row 2 Buttons:
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {ch.buttons_row2 && ch.buttons_row2.length > 0 ? (
                    ch.buttons_row2.map((btn, bIdx) => (
                      <div
                        key={bIdx}
                        className="py-1.5 px-2 bg-stone-900 border border-stone-800 rounded-lg text-[11px] font-mono text-cyan-300 text-center truncate"
                        title={btn.url}
                      >
                        {btn.text}
                      </div>
                    ))
                  ) : (
                    <div className="text-[11px] text-stone-500 italic col-span-2 text-center">
                      No Row 2 buttons configured
                    </div>
                  )}
                </div>
              </div>

              {/* Permission check banner if tested */}
              {testResult && testResult.id === ch.id && (
                <div
                  className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                    testResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {testResult.success ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <p className="font-semibold">{testResult.message}</p>
                      {testResult.chatTitle && (
                        <p className="text-[11px] opacity-90">
                          Channel Title: <span className="font-mono text-white">{testResult.chatTitle}</span>
                        </p>
                      )}
                      {testResult.resolvedChatId && (
                        <p className="text-[11px] opacity-90">
                          Resolved Chat ID: <span className="font-mono text-cyan-300">{testResult.resolvedChatId}</span>
                        </p>
                      )}
                      {testResult.details && (
                        <p className="text-[11px] text-stone-300 bg-black/30 p-2 rounded-lg mt-1.5 border border-stone-800">
                          💡 {testResult.details}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* If resolved ID is available and differs from current ID, allow 1-click update */}
                  {testResult.resolvedChatId && String(testResult.resolvedChatId) !== String(ch.channel_id) && (
                    <button
                      type="button"
                      onClick={async () => {
                        await onUpdateChannel(ch.id, { channel_id: String(testResult.resolvedChatId) });
                        handleTestChannel(ch.id);
                      }}
                      className="w-full mt-2 py-1 px-2.5 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 rounded-lg text-[11px] font-semibold text-center transition-colors"
                    >
                      💾 Save Numeric Chat ID ({testResult.resolvedChatId}) to Channel
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-stone-800 flex items-center justify-between gap-2">
              <button
                onClick={() => handleTestChannel(ch.id)}
                disabled={testingId === ch.id}
                className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{testingId === ch.id ? 'Checking...' : 'Test Bot Permissions'}</span>
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleOpenEdit(ch)}
                  className="p-2 text-stone-400 hover:text-stone-200 bg-stone-800 hover:bg-stone-750 rounded-lg"
                  title="Edit Channel & Buttons"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                {channels.length > 1 && (
                  <button
                    onClick={async () => {
                      if (confirm(`Delete ${ch.name}?`)) {
                        await onDeleteChannel(ch.id);
                      }
                    }}
                    className="p-2 text-rose-400 hover:text-rose-300 bg-rose-950/40 rounded-lg border border-rose-500/20"
                    title="Delete Channel"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CHANNEL EDIT / ADD MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-stone-900 border border-stone-750 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="text-base font-bold text-white">
                {editingChannel ? `✏ Edit ${editingChannel.name}` : '➕ Add Channel'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveChannel} className="space-y-4 text-xs">
              <div>
                <label className="block text-stone-300 font-medium mb-1">Channel Display Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Channel 1 (Main Network)"
                  className="w-full px-3 py-2 bg-stone-850 border border-stone-700 rounded-xl text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-medium mb-1">
                  Telegram Channel ID (Username @channel or numeric -100xxx)
                </label>
                <input
                  type="text"
                  required
                  value={channelIdInput}
                  onChange={(e) => setChannelIdInput(e.target.value)}
                  placeholder="@Anime_Network_Official"
                  className="w-full px-3 py-2 bg-stone-850 border border-stone-700 rounded-xl text-stone-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Row 2 Buttons Configuration */}
              <div className="pt-2 border-t border-stone-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-400">Row 2 Buttons Configuration</span>
                  {row2Buttons.length < 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        setRow2Buttons([...row2Buttons, { text: '◱ Link ◰', url: 'https://t.me/...' }])
                      }
                      className="text-xs text-amber-400 hover:underline"
                    >
                      + Add Button
                    </button>
                  )}
                </div>

                {row2Buttons.map((btn, idx) => (
                  <div key={idx} className="p-3 bg-stone-850 rounded-xl border border-stone-750 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-stone-400 font-medium">Button #{idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => setRow2Buttons(row2Buttons.filter((_, i) => i !== idx))}
                        className="text-rose-400 hover:underline text-[11px]"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Button Text"
                        value={btn.text}
                        onChange={(e) => {
                          const updated = [...row2Buttons];
                          updated[idx].text = e.target.value;
                          setRow2Buttons(updated);
                        }}
                        className="px-2.5 py-1.5 bg-stone-900 border border-stone-700 rounded-lg text-stone-100 font-mono text-xs"
                      />
                      <input
                        type="url"
                        placeholder="https://t.me/..."
                        value={btn.url}
                        onChange={(e) => {
                          const updated = [...row2Buttons];
                          updated[idx].url = e.target.value;
                          setRow2Buttons(updated);
                        }}
                        className="px-2.5 py-1.5 bg-stone-900 border border-stone-700 rounded-lg text-stone-100 font-mono text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold"
                >
                  {isSubmitting ? 'Saving...' : 'Save Channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

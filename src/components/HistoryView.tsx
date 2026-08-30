import React, { useState } from 'react';
import { PostingHistory } from '../types';
import { CheckCircle2, AlertCircle, Search, Trash2, ExternalLink, Filter, Calendar } from 'lucide-react';
import { formatEpisodeButtonText, formatToISTDisplay } from '../utils/formatter';

interface HistoryViewProps {
  history: PostingHistory[];
  onClearHistory: () => Promise<void>;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ history, onClearHistory }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'POSTED' | 'FAILED'>('ALL');

  const filtered = history.filter((h) => {
    const matchesSearch =
      h.anime_name.toLowerCase().includes(search.toLowerCase()) ||
      h.channel_name.toLowerCase().includes(search.toLowerCase()) ||
      (h.episode_range && h.episode_range.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || h.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Channel Posting History & Audit Log</h2>
          <p className="text-xs text-stone-400">
            Immutable log of all published episodes, links used, and Telegram message IDs.
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={async () => {
              if (confirm('Clear all posting history records?')) {
                await onClearHistory();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 text-xs font-semibold rounded-xl border border-rose-500/20 transition-colors shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by anime, channel, episode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex gap-2">
          {(['ALL', 'POSTED', 'FAILED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                statusFilter === st
                  ? 'bg-amber-500 text-stone-950 font-bold border-amber-500'
                  : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* History Table */}
      <div className="rounded-2xl bg-stone-900 border border-stone-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-stone-850 text-stone-400 uppercase font-mono text-[10px] tracking-wider border-b border-stone-800">
              <tr>
                <th className="py-3 px-4">Timestamp (IST)</th>
                <th className="py-3 px-4">Anime & Release</th>
                <th className="py-3 px-4">Button Text</th>
                <th className="py-3 px-4">Channel & Message ID</th>
                <th className="py-3 px-4">Link Used</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60 font-mono">
              {filtered.map((item) => {
                const btnFormatted = formatEpisodeButtonText(item.post_type, item.episode_range);
                return (
                  <tr key={item.id} className="hover:bg-stone-850/40 transition-colors">
                    <td className="py-3 px-4 text-stone-400 whitespace-nowrap">
                      {formatToISTDisplay(item.posted_at)}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <div className="font-bold text-white">{item.anime_name}</div>
                      <span className="text-[10px] font-mono text-amber-400">
                        {item.post_type === 'movie' ? 'Movie' : `Ep ${item.episode_range}`}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-stone-300 font-bold whitespace-nowrap">
                      {btnFormatted}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-stone-200 font-sans">{item.channel_name}</div>
                      <div className="text-[10px] text-stone-400">Msg ID: {item.telegram_message_id || 'N/A'}</div>
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate">
                      {item.episode_url ? (
                        <a
                          href={item.episode_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-400/90 hover:underline flex items-center gap-1"
                        >
                          <span className="truncate">{item.episode_url}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-stone-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.status === 'POSTED'
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-950/80 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center text-stone-500 text-xs space-y-2">
            <Calendar className="w-8 h-8 mx-auto text-stone-600" />
            <p>No audit log records match your query.</p>
          </div>
        )}
      </div>
    </div>
  );
};

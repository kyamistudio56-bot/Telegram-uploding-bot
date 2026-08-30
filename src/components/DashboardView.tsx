import React from 'react';
import { Anime, Channel, ScheduledPost, PostingHistory, BotSettings } from '../types';
import { PlusCircle, Send, Calendar, Radio, CheckCircle2, AlertCircle, Clock, Zap, Film, Tv, ShieldCheck, ArrowRight } from 'lucide-react';
import { formatEpisodeButtonText } from '../utils/formatter';

interface DashboardViewProps {
  animes: Anime[];
  channels: Channel[];
  schedules: ScheduledPost[];
  history: PostingHistory[];
  settings: BotSettings;
  onNavigate: (tab: string) => void;
  onPostNowSchedule: (scheduleId: string) => void;
  onSelectAnimeForPost: (anime: Anime) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  animes,
  channels,
  schedules,
  history,
  settings,
  onNavigate,
  onPostNowSchedule,
  onSelectAnimeForPost,
}) => {
  const pendingSchedules = schedules.filter((s) => s.state === 'PENDING' || s.state === 'PROCESSING');
  const enabledChannels = channels.filter((c) => c.is_enabled);
  const totalEpisodesPosted = animes.reduce((sum, a) => sum + (a.episodes_posted || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner / System Status */}
      <div className="rounded-2xl bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 border border-stone-800 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Multi-Owner CMS Mode Active</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Telegram Anime Poster & Episode Management
            </h2>
            <p className="text-sm text-stone-400 max-w-2xl">
              Configure once, post automatically. Permanent channel episode links, single/multiple episode ranges, movie releases, and atomic scheduling.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onNavigate('post_studio')}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm rounded-xl transition-all shadow-sm"
            >
              <Send className="w-4 h-4" />
              <span>Post Episode / Movie</span>
            </button>
            <button
              onClick={() => onNavigate('animes')}
              className="flex items-center gap-2 px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm font-medium rounded-xl border border-stone-700/80 transition-all"
            >
              <PlusCircle className="w-4 h-4 text-amber-400" />
              <span>Add Anime</span>
            </button>
            <button
              onClick={() => onNavigate('simulator')}
              className="flex items-center gap-2 px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm font-medium rounded-xl border border-stone-700/80 transition-all"
            >
              <Radio className="w-4 h-4 text-emerald-400" />
              <span>Bot Emulator</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-stone-900 border border-stone-800 p-4">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-medium uppercase tracking-wider">Total Animes</span>
            <Tv className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">{animes.length}</span>
            <span className="text-xs text-stone-400">in library</span>
          </div>
        </div>

        <div className="rounded-xl bg-stone-900 border border-stone-800 p-4">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-medium uppercase tracking-wider">Episodes Posted</span>
            <Film className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">{totalEpisodesPosted}</span>
            <span className="text-xs text-emerald-400/90 font-medium">broadcasted</span>
          </div>
        </div>

        <div className="rounded-xl bg-stone-900 border border-stone-800 p-4">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-medium uppercase tracking-wider">Pending Schedules</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">{pendingSchedules.length}</span>
            <span className="text-xs text-stone-400">queued in IST</span>
          </div>
        </div>

        <div className="rounded-xl bg-stone-900 border border-stone-800 p-4">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-medium uppercase tracking-wider">Enabled Channels</span>
            <Radio className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">
              {enabledChannels.length} / {channels.length}
            </span>
            <span className="text-xs text-emerald-400">active 2-ch</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Pending Schedules & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pending Schedules Card */}
        <div className="lg:col-span-6 rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <h3 className="text-base font-semibold text-white">Pending Scheduled Posts</h3>
            </div>
            <button
              onClick={() => onNavigate('schedules')}
              className="text-xs font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {pendingSchedules.length === 0 ? (
            <div className="py-8 text-center text-stone-500 text-sm border border-dashed border-stone-800 rounded-xl">
              No scheduled posts in queue. Click "Post Episode" to schedule a release.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingSchedules.slice(0, 4).map((sched) => {
                const btnFormat = formatEpisodeButtonText(sched.post_type, sched.episode_range);
                return (
                  <div
                    key={sched.id}
                    className="p-3.5 rounded-xl bg-stone-850/80 border border-stone-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-stone-100">{sched.anime_name}</span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {sched.post_type === 'movie' ? 'Movie' : `Ep ${sched.episode_range}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-stone-400 font-mono">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        <span>{sched.scheduled_time_display}</span>
                      </div>
                      <div className="text-[11px] font-mono text-stone-400 truncate max-w-xs">
                        Button: <span className="text-stone-300">{btnFormat}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => onPostNowSchedule(sched.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs rounded-lg transition-colors shadow-sm"
                        title="Publish immediately and mark completed"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Post Now</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Posting History Feed */}
        <div className="lg:col-span-6 rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-base font-semibold text-white">Recent Posting Activity</h3>
            </div>
            <button
              onClick={() => onNavigate('history')}
              className="text-xs font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              <span>Full audit log</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {history.length === 0 ? (
            <div className="py-8 text-center text-stone-500 text-sm border border-dashed border-stone-800 rounded-xl">
              No posting history recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {history.slice(0, 4).map((hist) => (
                <div
                  key={hist.id}
                  className="p-3 rounded-xl bg-stone-850/60 border border-stone-800/80 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-200">{hist.anime_name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-800 text-stone-300">
                        {hist.post_type === 'movie' ? 'Full Movie' : `Ep ${hist.episode_range}`}
                      </span>
                    </div>
                    <div className="text-stone-400 text-[11px]">
                      Channel: <span className="text-stone-300 font-medium">{hist.channel_name}</span>
                    </div>
                    {hist.episode_url && (
                      <a
                        href={hist.episode_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-amber-400/90 hover:underline truncate max-w-xs block font-mono"
                      >
                        {hist.episode_url}
                      </a>
                    )}
                  </div>

                  <div className="text-right shrink-0 space-y-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                        hist.status === 'POSTED'
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-950/60 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {hist.status}
                    </span>
                    <div className="text-[10px] text-stone-400 font-mono">
                      {new Date(hist.posted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Featured Anime Quick Roster */}
      <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Anime Catalog & Quick Post</h3>
            <p className="text-xs text-stone-400">All registered anime with permanent saved links</p>
          </div>
          <button
            onClick={() => onNavigate('animes')}
            className="text-xs font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1"
          >
            <span>Manage All ({animes.length})</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {animes.slice(0, 3).map((anime) => (
            <div
              key={anime.id}
              className="group relative rounded-xl bg-stone-850 border border-stone-750/80 overflow-hidden flex flex-col justify-between hover:border-amber-500/40 transition-all"
            >
              <div className="p-4 flex gap-3">
                <img
                  src={anime.poster}
                  alt={anime.name}
                  className="w-16 h-22 object-cover rounded-lg bg-stone-950 shrink-0 border border-stone-700"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="space-y-1.5 overflow-hidden">
                  <span className="text-[10px] font-mono font-medium text-amber-400/80">{anime.id}</span>
                  <h4 className="text-sm font-semibold text-white truncate group-hover:text-amber-300 transition-colors">
                    {anime.name}
                  </h4>
                  <div className="text-xs text-stone-400 flex items-center gap-2">
                    <span>Posts: <strong className="text-stone-200">{anime.episodes_posted}</strong></span>
                    <span>•</span>
                    <span>Last: <strong className="text-stone-200">{anime.last_posted_episode}</strong></span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-stone-900/90 border-t border-stone-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectAnimeForPost(anime)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-stone-950 text-xs font-semibold border border-amber-500/30 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Post Episode</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

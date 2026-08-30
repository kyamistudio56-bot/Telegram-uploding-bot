import React, { useState } from 'react';
import { ScheduledPost } from '../types';
import { Calendar, Clock, Zap, Edit3, Trash2, CheckCircle, AlertCircle, RefreshCw, X, ShieldAlert, ArrowRight } from 'lucide-react';
import { formatEpisodeButtonText, parseScheduleInput } from '../utils/formatter';

interface ScheduledPostsViewProps {
  schedules: ScheduledPost[];
  onPostNow: (scheduleId: string) => Promise<void>;
  onReschedule: (scheduleId: string, scheduleInput: string) => Promise<void>;
  onDeleteSchedule: (scheduleId: string) => Promise<void>;
  onRefresh: () => void;
}

export const ScheduledPostsView: React.FC<ScheduledPostsViewProps> = ({
  schedules,
  onPostNow,
  onReschedule,
  onDeleteSchedule,
  onRefresh,
}) => {
  const [filterState, setFilterState] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
  
  // Post Now Confirmation Modal State
  const [postNowTarget, setPostNowTarget] = useState<ScheduledPost | null>(null);
  const [isProcessingPostNow, setIsProcessingPostNow] = useState(false);

  // Reschedule Modal State
  const [rescheduleTarget, setRescheduleTarget] = useState<ScheduledPost | null>(null);
  const [rescheduleInput, setRescheduleInput] = useState('');
  const [reschedulePreview, setReschedulePreview] = useState('');
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState(false);

  const filtered = schedules.filter((s) => {
    if (filterState === 'PENDING') return s.state === 'PENDING' || s.state === 'PROCESSING';
    if (filterState === 'COMPLETED') return s.state === 'COMPLETED';
    return true;
  });

  const handleOpenReschedule = (sched: ScheduledPost) => {
    setRescheduleTarget(sched);
    setRescheduleInput('30m');
    try {
      const p = parseScheduleInput('30m');
      setReschedulePreview(p.displayIST);
    } catch {
      setReschedulePreview('');
    }
  };

  const handleRescheduleInputChange = (val: string) => {
    setRescheduleInput(val);
    try {
      const p = parseScheduleInput(val);
      setReschedulePreview(p.displayIST);
    } catch {
      setReschedulePreview('Invalid format');
    }
  };

  const handleConfirmReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTarget || !rescheduleInput) return;
    setIsSubmittingReschedule(true);
    try {
      await onReschedule(rescheduleTarget.id, rescheduleInput);
      setRescheduleTarget(null);
    } finally {
      setIsSubmittingReschedule(false);
    }
  };

  const handleConfirmPostNow = async () => {
    if (!postNowTarget) return;
    setIsProcessingPostNow(true);
    try {
      await onPostNow(postNowTarget.id);
      setPostNowTarget(null);
    } finally {
      setIsProcessingPostNow(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Scheduled Releases Manager</h2>
          <p className="text-xs text-stone-400">
            Persistent automated queue in Asia/Kolkata (IST). Atomic duplicate prevention on instant execution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-stone-900 border border-stone-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setFilterState('ALL')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                filterState === 'ALL' ? 'bg-amber-500 text-stone-950 font-bold' : 'text-stone-400 hover:text-white'
              }`}
            >
              All ({schedules.length})
            </button>
            <button
              onClick={() => setFilterState('PENDING')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                filterState === 'PENDING'
                  ? 'bg-amber-500 text-stone-950 font-bold'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Pending ({schedules.filter((s) => s.state === 'PENDING').length})
            </button>
            <button
              onClick={() => setFilterState('COMPLETED')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                filterState === 'COMPLETED'
                  ? 'bg-amber-500 text-stone-950 font-bold'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Completed ({schedules.filter((s) => s.state === 'COMPLETED').length})
            </button>
          </div>

          <button
            onClick={onRefresh}
            className="p-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
            title="Refresh Schedules"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Schedules List */}
      <div className="space-y-3">
        {filtered.map((sched, idx) => {
          const btnText = formatEpisodeButtonText(sched.post_type, sched.episode_range);
          const isPending = sched.state === 'PENDING';
          const isProcessing = sched.state === 'PROCESSING';

          return (
            <div
              key={sched.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                isPending
                  ? 'bg-stone-900 border-stone-800 hover:border-stone-700'
                  : sched.state === 'COMPLETED'
                  ? 'bg-stone-900/60 border-stone-850 opacity-80'
                  : 'bg-rose-950/20 border-rose-900/30'
              }`}
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold text-stone-400">#{idx + 1}</span>
                  <h3 className="text-sm font-bold text-white">{sched.anime_name}</h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {sched.post_type === 'movie' ? 'Full Movie' : `Episode ${sched.episode_range}`}
                  </span>

                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                      sched.state === 'PENDING'
                        ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/30'
                        : sched.state === 'PROCESSING'
                        ? 'bg-amber-950 text-amber-400 animate-pulse border border-amber-500/30'
                        : sched.state === 'COMPLETED'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-950 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {sched.state}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-400 font-mono">
                  <div className="flex items-center gap-1 text-cyan-300">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{sched.scheduled_time_display}</span>
                  </div>
                  <div>ID: <code>{sched.id}</code></div>
                  {sched.created_by && <div>By: {sched.created_by}</div>}
                </div>

                <div className="text-[11px] font-mono text-stone-400">
                  Formatted Button: <span className="text-amber-400 font-semibold">{btnText}</span>
                </div>

                {sched.error_message && (
                  <div className="text-xs text-rose-400 flex items-center gap-1 font-mono">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Error: {sched.error_message}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 self-end md:self-center shrink-0">
                {isPending && (
                  <>
                    <button
                      onClick={() => setPostNowTarget(sched)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-xl transition-all shadow-sm"
                      title="Post Now with duplicate lock"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>⚡ Post Now</span>
                    </button>

                    <button
                      onClick={() => handleOpenReschedule(sched)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-750 text-stone-200 text-xs font-medium rounded-xl border border-stone-700 transition-colors"
                      title="Move forward or backward in time"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>✏ Edit / Reschedule</span>
                    </button>
                  </>
                )}

                <button
                  onClick={async () => {
                    if (confirm(`Delete schedule for "${sched.anime_name}"?`)) {
                      await onDeleteSchedule(sched.id);
                    }
                  }}
                  className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-900/40 rounded-xl border border-rose-500/20 transition-colors"
                  title="Delete Schedule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="py-16 text-center text-stone-500 text-xs border border-dashed border-stone-800 rounded-2xl space-y-2">
            <Calendar className="w-8 h-8 mx-auto text-stone-600" />
            <p>No scheduled posts found matching filter.</p>
          </div>
        )}
      </div>

      {/* POST NOW CONFIRMATION MODAL */}
      {postNowTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-750 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
                <Zap className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">⚡ Post This Scheduled Item Now?</h3>
                <p className="text-xs text-stone-400">
                  This executes immediate publication to all enabled channels and marks the schedule as COMPLETED.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-stone-850 rounded-xl border border-stone-750 text-xs space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="text-stone-400">Anime:</span>
                <span className="text-white font-bold">{postNowTarget.anime_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Episode / Type:</span>
                <span className="text-amber-400 font-bold">{postNowTarget.episode_range}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400">Original Schedule:</span>
                <span className="text-cyan-300">{postNowTarget.scheduled_time_display}</span>
              </div>
            </div>

            <div className="p-3 bg-stone-950 border border-stone-800 rounded-xl text-[11px] text-stone-400 space-y-1">
              <div className="font-semibold text-stone-300">🛡️ Duplicate Protection Active:</div>
              <p>
                The job will atomically lock and cancel the future scheduler trigger so it will NOT publish again at {postNowTarget.scheduled_time_display}.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPostNowTarget(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 font-medium hover:bg-stone-750 text-xs"
              >
                ❌ CANCEL
              </button>
              <button
                type="button"
                disabled={isProcessingPostNow}
                onClick={handleConfirmPostNow}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-md"
              >
                {isProcessingPostNow ? 'Publishing...' : '⚡ YES, POST NOW'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT / RESCHEDULE MODAL */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-750 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-cyan-400" />
                <span>✏ Edit / Reschedule Post</span>
              </h3>
              <p className="text-xs text-stone-400">
                Move schedule forward or backward in time without creating duplicate jobs.
              </p>
            </div>

            <form onSubmit={handleConfirmReschedule} className="space-y-4 text-xs">
              <div className="p-3 bg-stone-850 rounded-xl border border-stone-750 space-y-1">
                <div className="font-bold text-white">{rescheduleTarget.anime_name} ({rescheduleTarget.episode_range})</div>
                <div className="text-stone-400 text-[11px] font-mono">
                  Current Time: {rescheduleTarget.scheduled_time_display}
                </div>
              </div>

              <div>
                <label className="block text-stone-300 font-medium mb-1">
                  Enter New Time (e.g. 10m, 2h, 1d, 22:30, 2026-08-15 22:30)
                </label>
                <input
                  type="text"
                  required
                  value={rescheduleInput}
                  onChange={(e) => handleRescheduleInputChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-stone-850 border border-stone-700 rounded-xl text-stone-100 font-mono text-sm focus:outline-none focus:border-cyan-400"
                />

                {/* Quick adjustments */}
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {['10m', '30m', '1h', '2h', '1d'].map((adj) => (
                    <button
                      key={adj}
                      type="button"
                      onClick={() => handleRescheduleInputChange(adj)}
                      className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-750 text-cyan-400 text-xs font-mono font-medium border border-stone-700"
                    >
                      +{adj}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolved Preview */}
              <div className="p-3 bg-stone-950 rounded-xl border border-stone-800 font-mono text-xs space-y-1">
                <span className="text-stone-400">Updated Time in IST:</span>
                <div className="text-cyan-300 font-bold">{reschedulePreview}</div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRescheduleTarget(null)}
                  className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 font-medium hover:bg-stone-750"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReschedule || reschedulePreview === 'Invalid format'}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-stone-950 font-bold disabled:opacity-50"
                >
                  {isSubmittingReschedule ? 'Updating...' : 'Update Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

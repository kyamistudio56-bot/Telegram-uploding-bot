import React, { useState, useEffect } from 'react';
import { Anime, AnimeChannelLink, Channel, PostType } from '../types';
import { Send, Calendar, Zap, CheckCircle2, AlertTriangle, Film, Tv, Radio, ExternalLink, Link as LinkIcon, Sparkles } from 'lucide-react';
import { formatEpisodeButtonText, parseScheduleInput, formatToISTDisplay, STUDIO_CREDIT } from '../utils/formatter';

interface PostStudioViewProps {
  animes: (Anime & { channel_links?: AnimeChannelLink[] })[];
  channels: Channel[];
  preselectedAnime?: Anime | null;
  onPublishNow: (data: {
    animeId: string;
    postType: PostType;
    episodeRange: string;
    customLinks?: Record<string, string>;
  }) => Promise<{ success: boolean; results?: any[]; errors?: string[] }>;
  onSchedulePost: (data: {
    animeId: string;
    postType: PostType;
    episodeRange: string;
    scheduleInput: string;
    customLinks?: Record<string, string>;
  }) => Promise<void>;
  onSavePermanentLink: (animeId: string, channelId: string, url: string) => Promise<void>;
  onNavigateToSchedules: () => void;
}

export const PostStudioView: React.FC<PostStudioViewProps> = ({
  animes,
  channels,
  preselectedAnime,
  onPublishNow,
  onSchedulePost,
  onSavePermanentLink,
  onNavigateToSchedules,
}) => {
  const [selectedAnimeId, setSelectedAnimeId] = useState<string>(preselectedAnime?.id || animes[0]?.id || '');
  const [postType, setPostType] = useState<PostType>('single_episode');
  const [episodeInput, setEpisodeInput] = useState<string>('03');
  
  // Custom overrides per channel
  const [customLinks, setCustomLinks] = useState<Record<string, string>>({});
  const [saveAsPermanent, setSaveAsPermanent] = useState<Record<string, boolean>>({});
  const [overrideToggled, setOverrideToggled] = useState<Record<string, boolean>>({});

  // Schedule modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleTimeInput, setScheduleTimeInput] = useState('30m');
  const [schedulePreviewIST, setSchedulePreviewIST] = useState('');

  // Execution states
  const [isProcessing, setIsProcessing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ success: boolean; message: string; results?: any[] } | null>(null);

  useEffect(() => {
    if (preselectedAnime) {
      setSelectedAnimeId(preselectedAnime.id);
    }
  }, [preselectedAnime]);

  const activeAnime = animes.find((a) => a.id === selectedAnimeId) || animes[0];

  const formattedButton = formatEpisodeButtonText(postType, episodeInput);

  // Quick calculate schedule preview
  useEffect(() => {
    try {
      const parsed = parseScheduleInput(scheduleTimeInput);
      setSchedulePreviewIST(parsed.displayIST);
    } catch {
      setSchedulePreviewIST('Invalid format');
    }
  }, [scheduleTimeInput]);

  const enabledChannels = channels.filter((c) => c.is_enabled);

  // Check if any channel is missing a link
  const channelLinkStatus = enabledChannels.map((ch) => {
    const perm = activeAnime?.channel_links?.find((l) => l.channel_id === ch.id && l.episode_url);
    const custom = customLinks[ch.id];
    const effectiveUrl = overrideToggled[ch.id] && custom ? custom : perm?.episode_url || '';
    return {
      channel: ch,
      permanentUrl: perm?.episode_url || '',
      effectiveUrl,
      hasLink: !!effectiveUrl,
    };
  });

  const allLinksReady = channelLinkStatus.every((s) => s.hasLink);

  const handleInstantPublish = async () => {
    if (!activeAnime || !allLinksReady) return;
    setIsProcessing(true);
    setPublishResult(null);

    try {
      // If user selected "Save as Permanent Link" for any overridden link, update permanent link in DB
      for (const ch of enabledChannels) {
        if (overrideToggled[ch.id] && customLinks[ch.id] && saveAsPermanent[ch.id]) {
          await onSavePermanentLink(activeAnime.id, ch.id, customLinks[ch.id]);
        }
      }

      const activeCustomLinks: Record<string, string> = {};
      enabledChannels.forEach((ch) => {
        if (overrideToggled[ch.id] && customLinks[ch.id]) {
          activeCustomLinks[ch.id] = customLinks[ch.id];
        }
      });

      const res = await onPublishNow({
        animeId: activeAnime.id,
        postType,
        episodeRange: postType === 'movie' ? 'Full Movie' : episodeInput,
        customLinks: Object.keys(activeCustomLinks).length > 0 ? activeCustomLinks : undefined,
      });

      if (res.success) {
        setPublishResult({
          success: true,
          message: `Post successfully published to all ${res.results?.length || 2} enabled channels!`,
          results: res.results,
        });
      } else {
        setPublishResult({
          success: false,
          message: `Publishing failed: ${res.errors?.join(', ')}`,
        });
      }
    } catch (err: any) {
      setPublishResult({
        success: false,
        message: err.message || 'Publishing error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAnime || !scheduleTimeInput) return;
    setIsProcessing(true);

    try {
      const activeCustomLinks: Record<string, string> = {};
      enabledChannels.forEach((ch) => {
        if (overrideToggled[ch.id] && customLinks[ch.id]) {
          activeCustomLinks[ch.id] = customLinks[ch.id];
        }
      });

      await onSchedulePost({
        animeId: activeAnime.id,
        postType,
        episodeRange: postType === 'movie' ? 'Full Movie' : episodeInput,
        scheduleInput: scheduleTimeInput,
        customLinks: Object.keys(activeCustomLinks).length > 0 ? activeCustomLinks : undefined,
      });

      setShowScheduleModal(false);
      onNavigateToSchedules();
    } catch (err: any) {
      alert(`Scheduling error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Episode & Movie Post Studio</h2>
          <p className="text-xs text-stone-400">
            Publish Single Episodes, Episode Ranges, or Full Movies across configured channels simultaneously.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
            Auto-Loads Saved Episode Links
          </span>
        </div>
      </div>

      {publishResult && (
        <div
          className={`p-4 rounded-2xl border ${
            publishResult.success
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
          } flex items-start gap-3 text-xs`}
        >
          {publishResult.success ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1 flex-1">
            <h4 className="font-bold text-sm text-white">
              {publishResult.success ? 'Published to Telegram Successfully' : 'Posting Notice'}
            </h4>
            <p>{publishResult.message}</p>
            {publishResult.results && (
              <div className="mt-2 space-y-0.5 text-[11px] font-mono text-stone-300">
                {publishResult.results.map((r: any, idx: number) => (
                  <div key={idx}>
                    • <strong>{r.channel}</strong> — Message ID: <code>{r.message_id}</code>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setPublishResult(null)}
            className="text-stone-400 hover:text-white px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Studio Controls Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Controls */}
        <div className="lg:col-span-5 space-y-5">
          {/* Step 1: Select Anime */}
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-300">
              1. Select Anime
            </label>
            <select
              value={selectedAnimeId}
              onChange={(e) => setSelectedAnimeId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-stone-850 border border-stone-700 rounded-xl text-stone-100 text-xs font-medium focus:outline-none focus:border-amber-500"
            >
              {animes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.id})
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Select Post Type */}
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-300">
              2. Choose Post Type
            </label>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setPostType('single_episode');
                  setEpisodeInput('03');
                }}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                  postType === 'single_episode'
                    ? 'bg-amber-500 text-stone-950 border-amber-500 shadow-sm'
                    : 'bg-stone-850 text-stone-300 border-stone-750 hover:bg-stone-800'
                }`}
              >
                <Tv className="w-4 h-4" />
                <span>Single Ep</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPostType('episode_range');
                  setEpisodeInput('02-03');
                }}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                  postType === 'episode_range'
                    ? 'bg-amber-500 text-stone-950 border-amber-500 shadow-sm'
                    : 'bg-stone-850 text-stone-300 border-stone-750 hover:bg-stone-800'
                }`}
              >
                <Film className="w-4 h-4" />
                <span>Ep Range</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPostType('movie');
                  setEpisodeInput('Full Movie');
                }}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                  postType === 'movie'
                    ? 'bg-amber-500 text-stone-950 border-amber-500 shadow-sm'
                    : 'bg-stone-850 text-stone-300 border-stone-750 hover:bg-stone-800'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Movie</span>
              </button>
            </div>

            {/* Episode Number or Range Input */}
            {postType !== 'movie' ? (
              <div className="space-y-2 pt-2 border-t border-stone-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-stone-300">
                    {postType === 'single_episode' ? 'Episode Number' : 'Episode Range'}
                  </label>
                  <span className="text-[11px] text-stone-400 font-mono">
                    {postType === 'single_episode' ? 'e.g. 01, 03' : 'e.g. 02-03, 12-23, 05-10'}
                  </span>
                </div>
                <input
                  type="text"
                  value={episodeInput}
                  onChange={(e) => setEpisodeInput(e.target.value)}
                  placeholder={postType === 'single_episode' ? '03' : '02-03'}
                  className="w-full px-3.5 py-2.5 bg-stone-850 border border-stone-700 rounded-xl text-stone-100 font-mono text-sm focus:outline-none focus:border-amber-500"
                />

                {/* Preset suggestions */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(postType === 'single_episode' ? ['01', '02', '03', '04', '12'] : ['01-02', '02-03', '01-12', '12-23']).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setEpisodeInput(preset)}
                      className="px-2 py-0.5 rounded-md bg-stone-800 hover:bg-stone-750 border border-stone-700 text-[11px] font-mono text-stone-300"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 space-y-1">
                <span className="font-semibold">🎬 Movie Mode Selected</span>
                <p className="text-[11px] text-stone-300">
                  Generates the dedicated <code>◱ 𝙁𝙐𝙇𝙇 𝙈𝙊𝙑𝙄𝙀 𝘼𝘿𝘿𝙀𝘿 ◰</code> button.
                </p>
              </div>
            )}

            {/* Live Formatted Unicode Button Output */}
            <div className="p-3 bg-stone-950 rounded-xl border border-stone-800 space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-wider text-stone-400">
                Generated Row 1 Button:
              </span>
              <div className="font-mono text-xs font-bold text-amber-400 bg-stone-900 py-1.5 px-3 rounded-lg border border-stone-800 text-center tracking-wide">
                {formattedButton}
              </div>
            </div>
          </div>

          {/* Step 3: Channel Links & Override Options */}
          <div className="rounded-2xl bg-stone-900 border border-stone-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-300">
                3. Permanent Channel Links
              </label>
              <span className="text-[10px] text-stone-400">Auto-configured</span>
            </div>

            <div className="space-y-3">
              {channelLinkStatus.map(({ channel, permanentUrl, effectiveUrl, hasLink }) => (
                <div
                  key={channel.id}
                  className="p-3.5 rounded-xl bg-stone-850 border border-stone-750 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-stone-200">{channel.name}</span>
                    {hasLink ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 text-[10px] border border-emerald-500/20 font-mono">
                        Link Ready
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-rose-950/60 text-rose-400 text-[10px] border border-rose-500/20 font-mono">
                        Missing Link
                      </span>
                    )}
                  </div>

                  {!overrideToggled[channel.id] ? (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-mono text-stone-400 truncate">
                        Saved: {permanentUrl ? <span className="text-amber-400/90">{permanentUrl}</span> : <em className="text-rose-400">None</em>}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setOverrideToggled({ ...overrideToggled, [channel.id]: true });
                          setCustomLinks({ ...customLinks, [channel.id]: permanentUrl || '' });
                        }}
                        className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 font-medium"
                      >
                        <LinkIcon className="w-3 h-3" />
                        <span>🔗 Use Different Link for this post</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1 border-t border-stone-800">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-amber-400 font-medium">Custom Link Override:</span>
                        <button
                          type="button"
                          onClick={() => setOverrideToggled({ ...overrideToggled, [channel.id]: false })}
                          className="text-[10px] text-stone-400 hover:text-stone-200 underline"
                        >
                          Use Permanent Link
                        </button>
                      </div>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={customLinks[channel.id] || ''}
                        onChange={(e) => setCustomLinks({ ...customLinks, [channel.id]: e.target.value })}
                        className="w-full px-3 py-1.5 bg-stone-900 border border-stone-700 rounded-lg text-stone-100 font-mono text-xs focus:outline-none focus:border-amber-500"
                      />
                      <label className="flex items-center gap-2 text-[11px] text-stone-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!saveAsPermanent[channel.id]}
                          onChange={(e) =>
                            setSaveAsPermanent({ ...saveAsPermanent, [channel.id]: e.target.checked })
                          }
                          className="rounded bg-stone-900 border-stone-700 text-amber-500 focus:ring-0"
                        />
                        <span>💾 Save as Permanent Link for future posts</span>
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons: Post Now & Schedule */}
          <div className="space-y-2">
            {!allLinksReady && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>One or more channels do not have a download URL configured. Please enter a URL to proceed.</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!allLinksReady || isProcessing}
                onClick={handleInstantPublish}
                className="flex items-center justify-center gap-2 py-3 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-stone-950 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md"
              >
                <Zap className="w-4 h-4" />
                <span>{isProcessing ? 'Publishing...' : '⚡ Post Now'}</span>
              </button>

              <button
                type="button"
                disabled={!allLinksReady || isProcessing}
                onClick={() => setShowScheduleModal(true)}
                className="flex items-center justify-center gap-2 py-3 px-4 bg-stone-800 hover:bg-stone-750 disabled:opacity-50 disabled:cursor-not-allowed text-stone-200 font-semibold text-xs sm:text-sm rounded-xl border border-stone-700 transition-all"
              >
                <Calendar className="w-4 h-4 text-cyan-400" />
                <span>📅 Schedule Post</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Visual Telegram Previews (Two Channels) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-stone-300">
              Live Telegram Two-Channel Message Preview
            </h3>
            <span className="text-[11px] font-mono text-stone-400">WYSIWYG Layout</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {channelLinkStatus.map(({ channel, effectiveUrl }) => (
              <div
                key={channel.id}
                className="rounded-2xl bg-stone-900 border border-stone-800 p-4 space-y-3 flex flex-col justify-between"
              >
                {/* Channel Header Banner */}
                <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-bold text-white truncate">{channel.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-stone-400">{channel.channel_id}</span>
                </div>

                {/* Simulated Telegram Message Bubble */}
                <div className="rounded-xl bg-[#1e232a] border border-[#2b323c] p-3 space-y-3 text-stone-200">
                  {/* Photo */}
                  <div className="aspect-[4/3] rounded-lg overflow-hidden bg-black/60 relative">
                    <img
                      src={activeAnime?.poster}
                      alt={activeAnime?.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>

                  {/* Caption */}
                  <div className="text-xs font-mono whitespace-pre-wrap text-stone-300 leading-relaxed max-h-36 overflow-y-auto scrollbar-thin">
                    {activeAnime?.caption}
                  </div>

                  {/* INLINE KEYBOARD ROW 1: DYNAMIC EPISODE BUTTON */}
                  <div className="space-y-1.5 pt-1">
                    <div className="w-full py-2 px-3 rounded-lg bg-[#2b5278] hover:bg-[#346392] text-white font-mono text-xs font-bold text-center tracking-wide shadow-sm flex items-center justify-center gap-1.5 cursor-pointer">
                      <span>{formattedButton}</span>
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </div>

                    {/* INLINE KEYBOARD ROW 2: CHANNEL SPECIFIC BUTTONS */}
                    {channel.buttons_row2 && channel.buttons_row2.length > 0 && (
                      <div className="grid grid-cols-2 gap-1.5">
                        {channel.buttons_row2.map((btn, idx) => (
                          <div
                            key={idx}
                            className="py-1.5 px-2 rounded-lg bg-[#253241] text-sky-200 text-[11px] font-mono font-medium text-center truncate cursor-pointer hover:bg-[#2e3e52]"
                          >
                            {btn.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Link Used */}
                <div className="text-[10px] font-mono text-stone-400 truncate">
                  Target Link: <span className="text-amber-400">{effectiveUrl || 'None'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SCHEDULE MODAL */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-750 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-cyan-400" />
                <span>📅 Schedule Post in Asia/Kolkata (IST)</span>
              </h3>
              <p className="text-xs text-stone-400">
                Survives bot restarts. You can Edit, Reschedule, or "⚡ Post Now" anytime.
              </p>
            </div>

            <form onSubmit={handleCreateSchedule} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-stone-850 border border-stone-750 space-y-1">
                <span className="text-stone-400">Selected Anime:</span>
                <div className="font-semibold text-stone-100">
                  {activeAnime?.name} ({postType === 'movie' ? 'Full Movie' : `Episode ${episodeInput}`})
                </div>
              </div>

              <div>
                <label className="block text-stone-300 font-medium mb-1">
                  Schedule Time (Relative or Absolute Date/Time)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 10m, 30m, 2h, 1d, 21:00, 2026-08-15 21:00"
                  value={scheduleTimeInput}
                  onChange={(e) => setScheduleTimeInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-stone-850 border border-stone-700 rounded-xl text-stone-100 font-mono text-sm focus:outline-none focus:border-cyan-400"
                />

                {/* Relative Presets */}
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {['10m', '30m', '1h', '2h', '10h', '1d'].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setScheduleTimeInput(val)}
                      className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-750 text-cyan-400 text-xs font-mono font-medium border border-stone-700"
                    >
                      +{val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolved IST Preview */}
              <div className="p-3 bg-stone-950 rounded-xl border border-stone-800 space-y-1 font-mono text-xs">
                <span className="text-stone-400">Scheduled Trigger (IST):</span>
                <div className="text-cyan-300 font-bold">{schedulePreviewIST}</div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 hover:bg-stone-750"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || schedulePreviewIST === 'Invalid format'}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-stone-950 font-bold disabled:opacity-50"
                >
                  {isProcessing ? 'Saving...' : 'Confirm Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

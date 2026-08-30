import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { AnimesView } from './components/AnimesView';
import { PostStudioView } from './components/PostStudioView';
import { ScheduledPostsView } from './components/ScheduledPostsView';
import { ChannelsView } from './components/ChannelsView';
import { HistoryView } from './components/HistoryView';
import { TelegramSimulatorView } from './components/TelegramSimulatorView';
import { SettingsView } from './components/SettingsView';
import { Anime, AnimeChannelLink, Channel, ScheduledPost, PostingHistory, BotSettings, PostType } from './types';
import { STUDIO_CREDIT } from './utils/formatter';
import { apiService } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [animes, setAnimes] = useState<(Anime & { channel_links?: AnimeChannelLink[] })[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [schedules, setSchedules] = useState<ScheduledPost[]>([]);
  const [history, setHistory] = useState<PostingHistory[]>([]);
  const [settings, setSettings] = useState<BotSettings>({
    bot_token: '',
    bot_owner_ids: ['724118793'],
    timezone: 'Asia/Kolkata',
    is_polling: false,
    studio_credit: STUDIO_CREDIT,
  });

  const [selectedAnimeForPost, setSelectedAnimeForPost] = useState<Anime | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch all CMS state from backend or synchronized local fallback
  const fetchData = useCallback(async () => {
    try {
      const data = await apiService.fetchAllState();
      if (data.animes) setAnimes(data.animes);
      if (data.channels) setChannels(data.channels);
      if (data.schedules) setSchedules(data.schedules);
      if (data.history) setHistory(data.history);
      if (data.settings) setSettings(data.settings);
    } catch (err) {
      console.warn('API sync notice:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Periodically sync background status and schedules
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Handle Quick Select Anime for Posting
  const handleSelectAnimeForPost = (anime: Anime) => {
    setSelectedAnimeForPost(anime);
    setActiveTab('post_studio');
  };

  // --- ANIME CRUD ---
  const handleCreateAnime = async (data: {
    name: string;
    poster: string;
    caption: string;
    channel_links: Record<string, string>;
  }) => {
    await apiService.createAnime(data);
    await fetchData();
  };

  const handleUpdateAnime = async (id: string, data: { name: string; poster: string; caption: string }) => {
    await apiService.updateAnime(id, data);
    await fetchData();
  };

  const handleDeleteAnime = async (id: string) => {
    await apiService.deleteAnime(id);
    await fetchData();
  };

  const handleSaveChannelLink = async (animeId: string, channelId: string, url: string) => {
    await apiService.saveChannelLink(animeId, channelId, url);
    await fetchData();
  };

  const handleDeleteChannelLink = async (animeId: string, channelId: string) => {
    await apiService.deleteChannelLink(animeId, channelId);
    await fetchData();
  };

  // --- CHANNEL CRUD ---
  const handleCreateChannel = async (data: { name: string; channel_id: string; buttons_row2: any[] }) => {
    await apiService.createChannel(data);
    await fetchData();
  };

  const handleUpdateChannel = async (id: string, data: Partial<Channel>) => {
    await apiService.updateChannel(id, data);
    await fetchData();
  };

  const handleDeleteChannel = async (id: string) => {
    await apiService.deleteChannel(id);
    await fetchData();
  };

  const handleTestChannelPermissions = async (channelId: string) => {
    return await apiService.testChannel(channelId);
  };

  // --- POSTING & SCHEDULING ---
  const handlePublishNow = async (data: {
    animeId: string;
    postType: PostType;
    episodeRange: string;
    customLinks?: Record<string, string>;
  }) => {
    const result = await apiService.publishPost(data);
    await fetchData();
    return result;
  };

  const handleSchedulePost = async (data: {
    animeId: string;
    postType: PostType;
    episodeRange: string;
    scheduleInput: string;
    customLinks?: Record<string, string>;
  }) => {
    await apiService.schedulePost(data);
    await fetchData();
  };

  const handlePostNowSchedule = async (scheduleId: string) => {
    await apiService.postNowSchedule(scheduleId);
    await fetchData();
  };

  const handleReschedule = async (scheduleId: string, scheduleInput: string) => {
    await apiService.reschedule(scheduleId, scheduleInput);
    await fetchData();
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    await apiService.deleteSchedule(scheduleId);
    await fetchData();
  };

  // --- SETTINGS & MISC ---
  const handleUpdateSettings = async (newSettings: Partial<BotSettings>) => {
    const result = await apiService.updateSettings(newSettings);
    if (result.settings) setSettings(result.settings);
  };

  const handleTogglePolling = async () => {
    const result = await apiService.togglePolling();
    if (result.settings) setSettings(result.settings);
  };

  const handleClearHistory = async () => {
    await apiService.clearHistory();
    await fetchData();
  };

  const handleBroadcast = async (message: string) => {
    const result = await apiService.broadcast(message);
    await fetchData();
    return result;
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-sans selection:bg-amber-500 selection:text-stone-950">
      {/* Header with Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isPolling={settings.is_polling}
        onTogglePolling={handleTogglePolling}
      />

      {/* Main Content View Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            animes={animes}
            channels={channels}
            schedules={schedules}
            history={history}
            settings={settings}
            onNavigate={setActiveTab}
            onPostNowSchedule={handlePostNowSchedule}
            onSelectAnimeForPost={handleSelectAnimeForPost}
          />
        )}

        {activeTab === 'animes' && (
          <AnimesView
            animes={animes}
            channels={channels}
            onSelectAnimeForPost={handleSelectAnimeForPost}
            onCreateAnime={handleCreateAnime}
            onUpdateAnime={handleUpdateAnime}
            onDeleteAnime={handleDeleteAnime}
            onSaveChannelLink={handleSaveChannelLink}
            onDeleteChannelLink={handleDeleteChannelLink}
          />
        )}

        {activeTab === 'post_studio' && (
          <PostStudioView
            animes={animes}
            channels={channels}
            preselectedAnime={selectedAnimeForPost}
            onPublishNow={handlePublishNow}
            onSchedulePost={handleSchedulePost}
            onSavePermanentLink={handleSaveChannelLink}
            onNavigateToSchedules={() => setActiveTab('schedules')}
          />
        )}

        {activeTab === 'schedules' && (
          <ScheduledPostsView
            schedules={schedules}
            onPostNow={handlePostNowSchedule}
            onReschedule={handleReschedule}
            onDeleteSchedule={handleDeleteSchedule}
            onRefresh={fetchData}
          />
        )}

        {activeTab === 'channels' && (
          <ChannelsView
            channels={channels}
            onCreateChannel={handleCreateChannel}
            onUpdateChannel={handleUpdateChannel}
            onDeleteChannel={handleDeleteChannel}
            onTestPermissions={handleTestChannelPermissions}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView history={history} onClearHistory={handleClearHistory} />
        )}

        {activeTab === 'simulator' && <TelegramSimulatorView />}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onTogglePolling={handleTogglePolling}
            onBroadcast={handleBroadcast}
          />
        )}
      </main>

      {/* Persistent Single Studio Credit Footer */}
      <footer className="bg-stone-900 border-t border-stone-800/80 py-4 text-center text-xs text-stone-400 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Telegram Anime Poster & Episode CMS • Version 2.0</span>
          <span className="text-amber-400/90 font-semibold">{STUDIO_CREDIT}</span>
        </div>
      </footer>
    </div>
  );
}

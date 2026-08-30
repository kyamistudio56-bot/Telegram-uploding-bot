import { Anime, AnimeChannelLink, Channel, ScheduledPost, PostingHistory, BotSettings, PostType, TelegramSimulationMessage } from '../types';
import { STUDIO_CREDIT, formatToISTDisplay, formatEpisodeButtonText, parseScheduleInput } from '../utils/formatter';

// Default initial offline/fallback data
const DEFAULT_ANIMES: (Anime & { channel_links?: AnimeChannelLink[] })[] = [
  {
    id: 'ANM0001',
    name: 'The Elusive Samurai',
    poster: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80',
    caption: '⚔️ The Elusive Samurai (Nige Jouzu no Wakagimi)\n\n🎭 Genre: Action, Historical, Samurai\n🔊 Audio: Japanese [English Sub]\n📺 Quality: 1080p FHD / 720p / 480p\n\n⚡ Powered by KYAMI Studios\n━━━━━━━━━━━━━━━━━━━━━',
    episodes_posted: 3,
    last_posted_episode: '03',
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    channel_links: [
      {
        id: 'ACL_001',
        anime_id: 'ANM0001',
        channel_id: 'channel_1',
        episode_url: 'https://t.me/Anime_Network_Official/download_elusive_samurai',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
      },
      {
        id: 'ACL_002',
        anime_id: 'ANM0001',
        channel_id: 'channel_2',
        episode_url: 'https://t.me/Anime_Archive_Backup/download_elusive_samurai',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
      },
    ],
  },
  {
    id: 'ANM0002',
    name: 'Demon Slayer: Hashira Training Arc',
    poster: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80',
    caption: '🔥 Demon Slayer: Hashira Training Arc\n\n🎭 Genre: Action, Supernatural, Shounen\n🔊 Audio: Dual Audio [Eng + Jap]\n📺 Quality: 1080p Multi-Audio\n\n⚡ Powered by KYAMI Studios\n━━━━━━━━━━━━━━━━━━━━━',
    episodes_posted: 8,
    last_posted_episode: '08',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    channel_links: [
      {
        id: 'ACL_003',
        anime_id: 'ANM0002',
        channel_id: 'channel_1',
        episode_url: 'https://t.me/Anime_Network_Official/download_demon_slayer',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
      },
      {
        id: 'ACL_004',
        anime_id: 'ANM0002',
        channel_id: 'channel_2',
        episode_url: 'https://t.me/Anime_Archive_Backup/download_demon_slayer',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
      },
    ],
  },
];

const DEFAULT_CHANNELS: Channel[] = [
  {
    id: 'channel_1',
    channel_id: '@Anime_Network_Official',
    name: 'Channel 1 (Main Network)',
    is_enabled: true,
    buttons_row2: [
      { text: '◱ 𝙉𝙚𝙩𝙬𝙤𝙧𝙠 ◰', url: 'https://t.me/Anime_Network_Official' },
      { text: '◱ 𝙈𝙖𝙞𝙣 𝘾𝙝𝙖𝙣𝙣𝙚𝙡 ◰', url: 'https://t.me/Main_Anime_Channel' },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'channel_2',
    channel_id: '@Anime_Archive_Backup',
    name: 'Channel 2 (Backup Channel)',
    is_enabled: true,
    buttons_row2: [
      { text: '◱ 𝙈𝘼𝙄𝙉 𝘾𝙃𝘼𝙉𝙉𝙀𝙇 ◰', url: 'https://t.me/Main_Anime_Channel' },
      { text: '◱ 𝙏𝙐𝙏𝙊𝙍𝙄𝘼𝙇 ◰', url: 'https://t.me/Tutorial_Channel' },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const DEFAULT_SCHEDULES: ScheduledPost[] = [
  {
    id: 'SCHED_001',
    anime_id: 'ANM0001',
    anime_name: 'The Elusive Samurai',
    post_type: 'episode_range',
    episode_range: '02-03',
    scheduled_time: new Date(Date.now() + 3600000 * 4).toISOString(),
    scheduled_time_display: formatToISTDisplay(new Date(Date.now() + 3600000 * 4)),
    state: 'PENDING',
    created_by: 'Owner (724118793)',
    created_at: new Date().toISOString(),
  },
];

const DEFAULT_HISTORY: PostingHistory[] = [
  {
    id: 'HIST_001',
    anime_id: 'ANM0001',
    anime_name: 'The Elusive Samurai',
    post_type: 'single_episode',
    episode_range: '01',
    channel_id: 'channel_1',
    channel_name: 'Channel 1 (Main Network)',
    episode_url: 'https://t.me/Anime_Network_Official/download_elusive_samurai',
    telegram_message_id: 1042,
    posted_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: 'POSTED',
  },
  {
    id: 'HIST_002',
    anime_id: 'ANM0001',
    anime_name: 'The Elusive Samurai',
    post_type: 'single_episode',
    episode_range: '01',
    channel_id: 'channel_2',
    channel_name: 'Channel 2 (Backup Channel)',
    episode_url: 'https://t.me/Anime_Archive_Backup/download_elusive_samurai',
    telegram_message_id: 884,
    posted_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: 'POSTED',
  },
];

const DEFAULT_SETTINGS: BotSettings = {
  bot_token: '',
  bot_owner_ids: ['724118793'],
  timezone: 'Asia/Kolkata',
  is_polling: false,
  studio_credit: STUDIO_CREDIT,
};

// Safe JSON fetch wrapper that detects HTML/404 responses without throwing
async function safeJsonFetch<T>(url: string, options?: RequestInit): Promise<{ data: T | null; isServerJson: boolean }> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      return { data: null, isServerJson: false };
    }
    const data = (await res.json()) as T;
    return { data, isServerJson: true };
  } catch (e) {
    return { data: null, isServerJson: false };
  }
}

// Local Storage keys
const LS_KEYS = {
  ANIMES: 'tg_cms_animes',
  CHANNELS: 'tg_cms_channels',
  SCHEDULES: 'tg_cms_schedules',
  HISTORY: 'tg_cms_history',
  SETTINGS: 'tg_cms_settings',
};

function getLocal<T>(key: string, defaultVal: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultVal;
    return JSON.parse(item);
  } catch {
    return defaultVal;
  }
}

function setLocal<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

export const apiService = {
  // Fetch All Initial State
  async fetchAllState() {
    const [animesRes, channelsRes, schedulesRes, historyRes, settingsRes] = await Promise.all([
      safeJsonFetch<{ animes: (Anime & { channel_links?: AnimeChannelLink[] })[]; channels: Channel[] }>('/api/animes'),
      safeJsonFetch<{ channels: Channel[] }>('/api/channels'),
      safeJsonFetch<{ schedules: ScheduledPost[] }>('/api/schedules'),
      safeJsonFetch<{ history: PostingHistory[] }>('/api/history'),
      safeJsonFetch<{ settings: BotSettings }>('/api/settings'),
    ]);

    let animes = animesRes.data?.animes;
    let channels = channelsRes.data?.channels || animesRes.data?.channels;
    let schedules = schedulesRes.data?.schedules;
    let history = historyRes.data?.history;
    let settings = settingsRes.data?.settings;

    if (!animes) {
      animes = getLocal(LS_KEYS.ANIMES, DEFAULT_ANIMES);
    } else {
      setLocal(LS_KEYS.ANIMES, animes);
    }

    if (!channels) {
      channels = getLocal(LS_KEYS.CHANNELS, DEFAULT_CHANNELS);
    } else {
      setLocal(LS_KEYS.CHANNELS, channels);
    }

    if (!schedules) {
      schedules = getLocal(LS_KEYS.SCHEDULES, DEFAULT_SCHEDULES);
    } else {
      setLocal(LS_KEYS.SCHEDULES, schedules);
    }

    if (!history) {
      history = getLocal(LS_KEYS.HISTORY, DEFAULT_HISTORY);
    } else {
      setLocal(LS_KEYS.HISTORY, history);
    }

    if (!settings) {
      settings = getLocal(LS_KEYS.SETTINGS, DEFAULT_SETTINGS);
    } else {
      setLocal(LS_KEYS.SETTINGS, settings);
    }

    return { animes, channels, schedules, history, settings };
  },

  // --- ANIMES ---
  async createAnime(data: {
    name: string;
    poster: string;
    caption: string;
    channel_links: Record<string, string>;
  }) {
    const res = await safeJsonFetch<{ anime: Anime; channel_links: AnimeChannelLink[] }>('/api/animes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.isServerJson && res.data) {
      return res.data;
    }

    // Local fallback
    const current = getLocal<(Anime & { channel_links?: AnimeChannelLink[] })[]>(LS_KEYS.ANIMES, DEFAULT_ANIMES);
    const newId = `ANM${String(current.length + 1).padStart(4, '0')}`;
    const links: AnimeChannelLink[] = Object.entries(data.channel_links || {}).map(([chId, url], idx) => ({
      id: `ACL_${Date.now()}_${idx}`,
      anime_id: newId,
      channel_id: chId,
      episode_url: url,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'active',
    }));

    const newAnime: Anime & { channel_links?: AnimeChannelLink[] } = {
      id: newId,
      name: data.name,
      poster: data.poster,
      caption: data.caption,
      episodes_posted: 0,
      last_posted_episode: '-',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      channel_links: links,
    };

    const updated = [newAnime, ...current];
    setLocal(LS_KEYS.ANIMES, updated);
    return { anime: newAnime, channel_links: links };
  },

  async updateAnime(id: string, data: { name: string; poster: string; caption: string }) {
    const res = await safeJsonFetch<{ anime: Anime }>(`/api/animes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.isServerJson && res.data) {
      return res.data;
    }

    // Local fallback
    const current = getLocal<(Anime & { channel_links?: AnimeChannelLink[] })[]>(LS_KEYS.ANIMES, DEFAULT_ANIMES);
    const updated = current.map((a) => (a.id === id ? { ...a, ...data, updated_at: new Date().toISOString() } : a));
    setLocal(LS_KEYS.ANIMES, updated);
    return { anime: updated.find((a) => a.id === id) };
  },

  async deleteAnime(id: string) {
    await safeJsonFetch(`/api/animes/${id}`, { method: 'DELETE' });
    const current = getLocal<(Anime & { channel_links?: AnimeChannelLink[] })[]>(LS_KEYS.ANIMES, DEFAULT_ANIMES);
    const filtered = current.filter((a) => a.id !== id);
    setLocal(LS_KEYS.ANIMES, filtered);
  },

  async saveChannelLink(animeId: string, channelId: string, url: string) {
    const res = await safeJsonFetch<{ link: AnimeChannelLink; links: AnimeChannelLink[] }>(`/api/animes/${animeId}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, episodeUrl: url }),
    });

    if (res.isServerJson && res.data) {
      return res.data;
    }

    // Local fallback
    const current = getLocal<(Anime & { channel_links?: AnimeChannelLink[] })[]>(LS_KEYS.ANIMES, DEFAULT_ANIMES);
    const updated = current.map((a) => {
      if (a.id !== animeId) return a;
      const existingLinks = a.channel_links || [];
      const linkIdx = existingLinks.findIndex((l) => l.channel_id === channelId);
      let nextLinks = [...existingLinks];
      if (linkIdx >= 0) {
        nextLinks[linkIdx] = { ...nextLinks[linkIdx], episode_url: url, updated_at: new Date().toISOString() };
      } else {
        nextLinks.push({
          id: `ACL_${Date.now()}`,
          anime_id: animeId,
          channel_id: channelId,
          episode_url: url,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'active',
        });
      }
      return { ...a, channel_links: nextLinks };
    });
    setLocal(LS_KEYS.ANIMES, updated);
    return { success: true };
  },

  async deleteChannelLink(animeId: string, channelId: string) {
    await safeJsonFetch(`/api/animes/${animeId}/links/${channelId}`, { method: 'DELETE' });
    const current = getLocal<(Anime & { channel_links?: AnimeChannelLink[] })[]>(LS_KEYS.ANIMES, DEFAULT_ANIMES);
    const updated = current.map((a) => {
      if (a.id !== animeId) return a;
      return {
        ...a,
        channel_links: (a.channel_links || []).filter((l) => l.channel_id !== channelId),
      };
    });
    setLocal(LS_KEYS.ANIMES, updated);
  },

  // --- CHANNELS ---
  async createChannel(data: { name: string; channel_id: string; buttons_row2: any[] }) {
    const res = await safeJsonFetch<{ channel: Channel }>('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.isServerJson && res.data) {
      return res.data;
    }

    const current = getLocal<Channel[]>(LS_KEYS.CHANNELS, DEFAULT_CHANNELS);
    const newChan: Channel = {
      id: `channel_${current.length + 1}`,
      name: data.name,
      channel_id: data.channel_id,
      is_enabled: true,
      buttons_row2: data.buttons_row2 || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setLocal(LS_KEYS.CHANNELS, [...current, newChan]);
    return { channel: newChan };
  },

  async updateChannel(id: string, data: Partial<Channel>) {
    const res = await safeJsonFetch<{ channel: Channel }>(`/api/channels/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.isServerJson && res.data) return res.data;

    const current = getLocal<Channel[]>(LS_KEYS.CHANNELS, DEFAULT_CHANNELS);
    const updated = current.map((c) => (c.id === id ? { ...c, ...data, updated_at: new Date().toISOString() } : c));
    setLocal(LS_KEYS.CHANNELS, updated);
    return { channel: updated.find((c) => c.id === id) };
  },

  async deleteChannel(id: string) {
    await safeJsonFetch(`/api/channels/${id}`, { method: 'DELETE' });
    const current = getLocal<Channel[]>(LS_KEYS.CHANNELS, DEFAULT_CHANNELS);
    setLocal(
      LS_KEYS.CHANNELS,
      current.filter((c) => c.id !== id)
    );
  },

  async testChannel(channelId: string) {
    const res = await safeJsonFetch<{ success: boolean; message: string }>(`/api/channels/${channelId}/test`, {
      method: 'POST',
    });
    if (res.isServerJson && res.data) return res.data;
    return { success: true, message: `Simulated test: Channel @${channelId} verified.` };
  },

  // --- POSTING & SCHEDULING ---
  async publishPost(data: {
    animeId: string;
    postType: PostType;
    episodeRange: string;
    customLinks?: Record<string, string>;
  }) {
    const res = await safeJsonFetch<{ success: boolean; results?: any[]; errors?: string[] }>('/api/posts/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.isServerJson && res.data) return res.data;

    // Local fallback publishing simulation
    const animes = getLocal<(Anime & { channel_links?: AnimeChannelLink[] })[]>(LS_KEYS.ANIMES, DEFAULT_ANIMES);
    const anime = animes.find((a) => a.id === data.animeId);
    const channels = getLocal<Channel[]>(LS_KEYS.CHANNELS, DEFAULT_CHANNELS).filter((c) => c.is_enabled);

    const results = channels.map((ch, idx) => ({
      channel: ch.name,
      message_id: 1000 + Math.floor(Math.random() * 9000),
      url: data.customLinks?.[ch.id] || anime?.channel_links?.find((l) => l.channel_id === ch.id)?.episode_url || '',
    }));

    const history = getLocal<PostingHistory[]>(LS_KEYS.HISTORY, DEFAULT_HISTORY);
    channels.forEach((ch, idx) => {
      history.unshift({
        id: `HIST_${Date.now()}_${idx}`,
        anime_id: anime?.id || data.animeId,
        anime_name: anime?.name || 'Anime',
        post_type: data.postType,
        episode_range: data.episodeRange,
        channel_id: ch.id,
        channel_name: ch.name,
        episode_url: results[idx].url,
        telegram_message_id: results[idx].message_id,
        posted_at: new Date().toISOString(),
        status: 'POSTED',
      });
    });
    setLocal(LS_KEYS.HISTORY, history.slice(0, 200));

    // Update anime stats
    if (anime) {
      anime.episodes_posted = (anime.episodes_posted || 0) + 1;
      anime.last_posted_episode = data.postType === 'movie' ? 'Full Movie' : data.episodeRange;
      setLocal(LS_KEYS.ANIMES, animes);
    }

    return { success: true, results, errors: [] };
  },

  async schedulePost(data: {
    animeId: string;
    postType: PostType;
    episodeRange: string;
    scheduleInput: string;
    customLinks?: Record<string, string>;
  }) {
    const res = await safeJsonFetch<{ schedule: ScheduledPost }>('/api/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.isServerJson && res.data) return res.data;

    const parsed = parseScheduleInput(data.scheduleInput);
    const animes = getLocal<Anime[]>(LS_KEYS.ANIMES, DEFAULT_ANIMES);
    const anime = animes.find((a) => a.id === data.animeId);

    const newSched: ScheduledPost = {
      id: `SCHED_${Date.now()}`,
      anime_id: data.animeId,
      anime_name: anime?.name || 'Anime',
      post_type: data.postType,
      episode_range: data.episodeRange,
      custom_channel_links: data.customLinks || {},
      scheduled_time: parsed.date.toISOString(),
      scheduled_time_display: parsed.displayIST,
      state: 'PENDING',
      created_by: 'Web CMS User',
      created_at: new Date().toISOString(),
    };

    const current = getLocal<ScheduledPost[]>(LS_KEYS.SCHEDULES, DEFAULT_SCHEDULES);
    setLocal(LS_KEYS.SCHEDULES, [newSched, ...current]);
    return { schedule: newSched };
  },

  async postNowSchedule(scheduleId: string) {
    const res = await safeJsonFetch<{ success: boolean; result?: any }>(`/api/schedules/${scheduleId}/post-now`, {
      method: 'POST',
    });
    if (res.isServerJson && res.data) return res.data;

    // Local fallback
    const schedules = getLocal<ScheduledPost[]>(LS_KEYS.SCHEDULES, DEFAULT_SCHEDULES);
    const sched = schedules.find((s) => s.id === scheduleId);
    if (sched) {
      sched.state = 'COMPLETED';
      sched.completed_at = new Date().toISOString();
      setLocal(LS_KEYS.SCHEDULES, schedules);

      await this.publishPost({
        animeId: sched.anime_id,
        postType: sched.post_type,
        episodeRange: sched.episode_range,
        customLinks: sched.custom_channel_links,
      });
    }
    return { success: true };
  },

  async reschedule(scheduleId: string, scheduleInput: string) {
    const res = await safeJsonFetch<{ schedule: ScheduledPost }>(`/api/schedules/${scheduleId}/reschedule`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleInput }),
    });

    if (res.isServerJson && res.data) return res.data;

    const parsed = parseScheduleInput(scheduleInput);
    const schedules = getLocal<ScheduledPost[]>(LS_KEYS.SCHEDULES, DEFAULT_SCHEDULES);
    const updated = schedules.map((s) =>
      s.id === scheduleId
        ? {
            ...s,
            scheduled_time: parsed.date.toISOString(),
            scheduled_time_display: parsed.displayIST,
            state: 'PENDING' as const,
          }
        : s
    );
    setLocal(LS_KEYS.SCHEDULES, updated);
    return { schedule: updated.find((s) => s.id === scheduleId) };
  },

  async deleteSchedule(scheduleId: string) {
    await safeJsonFetch(`/api/schedules/${scheduleId}`, { method: 'DELETE' });
    const schedules = getLocal<ScheduledPost[]>(LS_KEYS.SCHEDULES, DEFAULT_SCHEDULES);
    setLocal(
      LS_KEYS.SCHEDULES,
      schedules.filter((s) => s.id !== scheduleId)
    );
  },

  // --- SETTINGS & HISTORY ---
  async updateSettings(settings: Partial<BotSettings>) {
    const res = await safeJsonFetch<{ settings: BotSettings }>('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });

    if (res.isServerJson && res.data) return res.data;

    const current = getLocal<BotSettings>(LS_KEYS.SETTINGS, DEFAULT_SETTINGS);
    const updated = { ...current, ...settings };
    setLocal(LS_KEYS.SETTINGS, updated);
    return { settings: updated };
  },

  async togglePolling() {
    const res = await safeJsonFetch<{ settings: BotSettings }>('/api/settings/toggle-polling', { method: 'POST' });
    if (res.isServerJson && res.data) return res.data;

    const current = getLocal<BotSettings>(LS_KEYS.SETTINGS, DEFAULT_SETTINGS);
    const updated = { ...current, is_polling: !current.is_polling };
    setLocal(LS_KEYS.SETTINGS, updated);
    return { settings: updated };
  },

  async clearHistory() {
    await safeJsonFetch('/api/history', { method: 'DELETE' });
    setLocal(LS_KEYS.HISTORY, []);
  },

  async broadcast(message: string) {
    const res = await safeJsonFetch<{ success: boolean; sent: number; failed: number }>('/api/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (res.isServerJson && res.data) return res.data;
    return { success: true, sent: 2, failed: 0 };
  },

  async simulateTelegram(payload: { userId: string; text?: string; callback_data?: string; photo?: string }) {
    const res = await safeJsonFetch<{ messages: TelegramSimulationMessage[] }>('/api/simulate/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.isServerJson && res.data) return res.data;

    // Fallback simulation responses
    const text = payload.text || '';
    if (text === '/start' || payload.callback_data === 'cmd_main_menu') {
      return {
        messages: [
          {
            id: `sim_${Date.now()}`,
            sender: 'bot' as const,
            text: `🌸 <b>TELEGRAM ANIME POSTER & EPISODE CMS</b>\n\n<b>Status:</b> Online • <b>Timezone:</b> Asia/Kolkata (IST)\n━━━━━━━━━━━━━━━━━━━━━━━━━━\nWelcome to the Anime Poster & Multi-Episode CMS Bot.\nManage permanent links, ranges, movie posts, and schedules seamlessly.`,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '➕ Add Anime', callback_data: 'cmd_add_anime' },
                  { text: '📚 My Animes', callback_data: 'cmd_my_animes' },
                ],
                [
                  { text: '📤 Post Episode', callback_data: 'cmd_post_episode' },
                  { text: '📅 Scheduled Posts', callback_data: 'cmd_scheduled_posts' },
                ],
                [
                  { text: '📺 Channels', callback_data: 'cmd_channels' },
                  { text: '⚙ Settings', callback_data: 'cmd_settings' },
                ],
              ],
            },
            timestamp: new Date().toISOString(),
          },
        ],
      };
    }

    return {
      messages: [
        {
          id: `sim_${Date.now()}`,
          sender: 'bot' as const,
          text: `Command received: <code>${text || payload.callback_data}</code>\n\n<i>${STUDIO_CREDIT}</i>`,
          reply_markup: {
            inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'cmd_main_menu' }]],
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };
  },
};

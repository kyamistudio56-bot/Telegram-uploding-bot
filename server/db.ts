import fs from 'fs';
import path from 'path';
import { Anime, AnimeChannelLink, Channel, ScheduledPost, PostingHistory, BotSettings, BroadcastLog } from '../src/types';
import { STUDIO_CREDIT, formatToISTDisplay } from '../src/utils/formatter';

interface DatabaseSchema {
  animes: Anime[];
  anime_channel_links: AnimeChannelLink[];
  channels: Channel[];
  scheduled_posts: ScheduledPost[];
  posting_history: PostingHistory[];
  settings: BotSettings;
  broadcast_logs: BroadcastLog[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Default initial state
function getInitialData(): DatabaseSchema {
  const envOwnerIds = process.env.BOT_OWNER_IDS
    ? process.env.BOT_OWNER_IDS.split(',').map((s) => s.trim().replace(/[^\d]/g, '')).filter(Boolean)
    : ['724118793'];

  return {
    animes: [
      {
        id: 'ANM0001',
        name: 'The Elusive Samurai',
        poster: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80',
        caption: '⚔️ The Elusive Samurai (Nige Jouzu no Wakagimi)\n\n🎭 Genre: Action, Historical, Samurai\n🔊 Audio: Japanese [English Sub]\n📺 Quality: 1080p FHD / 720p / 480p\n\n⚡ Powered by KYAMI Studios\n━━━━━━━━━━━━━━━━━━━━━',
        episodes_posted: 3,
        last_posted_episode: '03',
        created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
        updated_at: new Date().toISOString(),
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
      },
    ],
    anime_channel_links: [
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
    channels: [
      {
        id: 'channel_1',
        channel_id: '-1004368859064',
        name: 'Main Network',
        is_enabled: true,
        buttons_row2: [
          { text: '◱ 𝙉𝙚𝙩𝙬𝙤𝙧𝙠 ◰', url: 'https://t.me/+Yv5QRA9DGetmOWQx' },
          { text: '◱ 𝙈𝙖𝙞𝙣 𝘾𝙝𝙖𝙣𝙣𝙚𝙡 ◰', url: 'https://t.me/+I6mn5JJTyWlhZTNl' },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'channel_2',
        channel_id: '-1002835294159',
        name: 'Backup Channel',
        is_enabled: true,
        buttons_row2: [
          { text: '◱ 𝙈𝘼𝙄𝙉 𝘾𝙃𝘼𝙉𝙉𝙀𝙇 ◰', url: 'https://t.me/anime_in_hindi_dub_channel' },
          { text: '◱ 𝙏𝙐𝙏𝙊𝙍𝙄𝘼𝙇 ◰', url: 'https://t.me/HOW_TO_DOWNLOAD_ANIME_FREE' },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    scheduled_posts: [
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
    ],
    posting_history: [
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
    ],
    settings: {
      bot_token: process.env.BOT_TOKEN?.trim() || '',
      bot_owner_ids: envOwnerIds,
      timezone: process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata',
      is_polling: false,
      studio_credit: STUDIO_CREDIT,
    },
    broadcast_logs: [],
  };
}

class Database {
  private data: DatabaseSchema;
  private isSaving = false;
  private savePending = false;

  constructor() {
    this.data = this.loadFromDisk();
  }

  private loadFromDisk(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        // Ensure defaults if any key missing
        const initial = getInitialData();
        return {
          animes: Array.isArray(parsed.animes) ? parsed.animes : initial.animes,
          anime_channel_links: Array.isArray(parsed.anime_channel_links) ? parsed.anime_channel_links : initial.anime_channel_links,
          channels: Array.isArray(parsed.channels) ? parsed.channels : initial.channels,
          scheduled_posts: Array.isArray(parsed.scheduled_posts) ? parsed.scheduled_posts : initial.scheduled_posts,
          posting_history: Array.isArray(parsed.posting_history) ? parsed.posting_history : initial.posting_history,
          settings: parsed.settings ? { ...initial.settings, ...parsed.settings } : initial.settings,
          broadcast_logs: Array.isArray(parsed.broadcast_logs) ? parsed.broadcast_logs : initial.broadcast_logs,
        };
      }
    } catch (err) {
      console.error('[DB] Error loading db.json, using defaults:', err);
    }

    const init = getInitialData();
    this.saveDirect(init);
    return init;
  }

  private async saveToDisk() {
    if (this.isSaving) {
      this.savePending = true;
      return;
    }

    this.isSaving = true;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
      await fs.promises.writeFile(tmpFile, JSON.stringify(this.data, null, 2), 'utf-8');
      await fs.promises.rename(tmpFile, DB_FILE);
    } catch (err) {
      console.error('[DB] Save error:', err);
    } finally {
      this.isSaving = false;
      if (this.savePending) {
        this.savePending = false;
        this.saveToDisk();
      }
    }
  }

  private saveDirect(data: DatabaseSchema) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] Direct save error:', err);
    }
  }

  // --- ANIMES ---
  public getAnimes(): Anime[] {
    return [...this.data.animes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public getAnime(id: string): Anime | undefined {
    return this.data.animes.find((a) => a.id === id);
  }

  public createAnime(item: Omit<Anime, 'id' | 'created_at' | 'updated_at' | 'episodes_posted' | 'last_posted_episode'> & { id?: string }): Anime {
    const nextNum = this.data.animes.length + 1;
    const id = item.id || `ANM${String(nextNum).padStart(4, '0')}`;
    const newAnime: Anime = {
      id,
      name: item.name,
      poster: item.poster,
      caption: item.caption,
      episodes_posted: 0,
      last_posted_episode: '-',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.data.animes.push(newAnime);
    this.saveToDisk();
    return newAnime;
  }

  public updateAnime(id: string, updates: Partial<Anime>): Anime | null {
    const idx = this.data.animes.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    this.data.animes[idx] = {
      ...this.data.animes[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.saveToDisk();
    return this.data.animes[idx];
  }

  public deleteAnime(id: string): boolean {
    const initLen = this.data.animes.length;
    this.data.animes = this.data.animes.filter((a) => a.id !== id);
    // Also remove associated links and scheduled posts
    this.data.anime_channel_links = this.data.anime_channel_links.filter((l) => l.anime_id !== id);
    this.data.scheduled_posts = this.data.scheduled_posts.filter((s) => s.anime_id !== id);
    this.saveToDisk();
    return this.data.animes.length < initLen;
  }

  // --- PERMANENT CHANNEL LINKS ---
  public getChannelLinks(animeId: string): AnimeChannelLink[] {
    return this.data.anime_channel_links.filter((l) => l.anime_id === animeId);
  }

  public getChannelLink(animeId: string, channelId: string): AnimeChannelLink | undefined {
    return this.data.anime_channel_links.find((l) => l.anime_id === animeId && l.channel_id === channelId);
  }

  public saveChannelLink(animeId: string, channelId: string, episodeUrl: string): AnimeChannelLink {
    const existingIdx = this.data.anime_channel_links.findIndex(
      (l) => l.anime_id === animeId && l.channel_id === channelId
    );

    const now = new Date().toISOString();
    if (existingIdx >= 0) {
      this.data.anime_channel_links[existingIdx] = {
        ...this.data.anime_channel_links[existingIdx],
        episode_url: episodeUrl,
        updated_at: now,
        status: 'active',
      };
      this.saveToDisk();
      return this.data.anime_channel_links[existingIdx];
    } else {
      const newLink: AnimeChannelLink = {
        id: `ACL_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        anime_id: animeId,
        channel_id: channelId,
        episode_url: episodeUrl,
        created_at: now,
        updated_at: now,
        status: 'active',
      };
      this.data.anime_channel_links.push(newLink);
      this.saveToDisk();
      return newLink;
    }
  }

  public deleteChannelLink(animeId: string, channelId: string): boolean {
    const initLen = this.data.anime_channel_links.length;
    this.data.anime_channel_links = this.data.anime_channel_links.filter(
      (l) => !(l.anime_id === animeId && l.channel_id === channelId)
    );
    this.saveToDisk();
    return this.data.anime_channel_links.length < initLen;
  }

  // --- CHANNELS ---
  public getChannels(): Channel[] {
    return this.data.channels.map((c) => ({
      ...c,
      telegram_channel_id: c.telegram_channel_id || c.channel_id,
    }));
  }

  public getChannel(id: string): Channel | undefined {
    const c = this.data.channels.find((ch) => ch.id === id);
    if (!c) return undefined;
    return {
      ...c,
      telegram_channel_id: c.telegram_channel_id || c.channel_id,
    };
  }

  public updateChannel(id: string, updates: Partial<Channel>): Channel | null {
    const idx = this.data.channels.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const effectiveChannelId = updates.channel_id || updates.telegram_channel_id || this.data.channels[idx].channel_id;
    this.data.channels[idx] = {
      ...this.data.channels[idx],
      ...updates,
      channel_id: effectiveChannelId,
      telegram_channel_id: effectiveChannelId,
      updated_at: new Date().toISOString(),
    };
    this.saveToDisk();
    return this.data.channels[idx];
  }

  public createChannel(data: Omit<Channel, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Channel {
    const id = data.id || `channel_${this.data.channels.length + 1}`;
    const effectiveChannelId = data.channel_id || data.telegram_channel_id || '';
    const newChan: Channel = {
      id,
      channel_id: effectiveChannelId,
      telegram_channel_id: effectiveChannelId,
      name: data.name,
      is_enabled: data.is_enabled ?? true,
      buttons_row2: data.buttons_row2 || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.data.channels.push(newChan);
    this.saveToDisk();
    return newChan;
  }

  public deleteChannel(id: string): boolean {
    if (this.data.channels.length <= 1) return false; // keep at least one
    const initLen = this.data.channels.length;
    this.data.channels = this.data.channels.filter((c) => c.id !== id);
    this.data.anime_channel_links = this.data.anime_channel_links.filter((l) => l.channel_id !== id);
    this.saveToDisk();
    return this.data.channels.length < initLen;
  }

  // --- SCHEDULED POSTS ---
  public getScheduledPosts(): ScheduledPost[] {
    return [...this.data.scheduled_posts].sort(
      (a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime()
    );
  }

  public getScheduledPost(id: string): ScheduledPost | undefined {
    return this.data.scheduled_posts.find((s) => s.id === id);
  }

  public createScheduledPost(data: Omit<ScheduledPost, 'id' | 'created_at' | 'state'>): ScheduledPost {
    const id = `SCHED_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newSchedule: ScheduledPost = {
      id,
      anime_id: data.anime_id,
      anime_name: data.anime_name,
      post_type: data.post_type,
      episode_range: data.episode_range,
      custom_channel_links: data.custom_channel_links || {},
      scheduled_time: data.scheduled_time,
      scheduled_time_display: data.scheduled_time_display || formatToISTDisplay(data.scheduled_time),
      state: 'PENDING',
      created_by: data.created_by || 'Owner',
      created_at: new Date().toISOString(),
    };
    this.data.scheduled_posts.push(newSchedule);
    this.saveToDisk();
    return newSchedule;
  }

  public updateScheduledPost(id: string, updates: Partial<ScheduledPost>): ScheduledPost | null {
    const idx = this.data.scheduled_posts.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    this.data.scheduled_posts[idx] = {
      ...this.data.scheduled_posts[idx],
      ...updates,
    };
    this.saveToDisk();
    return this.data.scheduled_posts[idx];
  }

  /**
   * Atomically transitions schedule from PENDING -> PROCESSING
   * Prevents race conditions / duplicate firing
   */
  public atomicClaimSchedule(id: string): boolean {
    const item = this.data.scheduled_posts.find((s) => s.id === id);
    if (!item || item.state !== 'PENDING') {
      return false;
    }
    item.state = 'PROCESSING';
    this.saveToDisk();
    return true;
  }

  public completeSchedule(id: string): void {
    const item = this.data.scheduled_posts.find((s) => s.id === id);
    if (item) {
      item.state = 'COMPLETED';
      item.completed_at = new Date().toISOString();
      this.saveToDisk();
    }
  }

  public failSchedule(id: string, errorMessage: string): void {
    const item = this.data.scheduled_posts.find((s) => s.id === id);
    if (item) {
      item.state = 'FAILED';
      item.error_message = errorMessage;
      this.saveToDisk();
    }
  }

  public deleteScheduledPost(id: string): boolean {
    const initLen = this.data.scheduled_posts.length;
    this.data.scheduled_posts = this.data.scheduled_posts.filter((s) => s.id !== id);
    this.saveToDisk();
    return this.data.scheduled_posts.length < initLen;
  }

  // --- POSTING HISTORY ---
  public getPostingHistory(): PostingHistory[] {
    return [...this.data.posting_history].sort(
      (a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()
    );
  }

  public addPostingHistory(item: Omit<PostingHistory, 'id' | 'posted_at'>): PostingHistory {
    const newHist: PostingHistory = {
      id: `HIST_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      ...item,
      posted_at: new Date().toISOString(),
    };
    this.data.posting_history.unshift(newHist);
    // Keep max 500 history records
    if (this.data.posting_history.length > 500) {
      this.data.posting_history = this.data.posting_history.slice(0, 500);
    }
    this.saveToDisk();
    return newHist;
  }

  public clearPostingHistory(): void {
    this.data.posting_history = [];
    this.saveToDisk();
  }

  // --- SETTINGS ---
  public getSettings(): BotSettings {
    const envToken = process.env.BOT_TOKEN?.trim();
    const envOwners = process.env.BOT_OWNER_IDS
      ? process.env.BOT_OWNER_IDS.split(',').map((s) => s.trim().replace(/[^\d]/g, '')).filter(Boolean)
      : [];

    const currentOwners = envOwners.length > 0
      ? envOwners
      : (this.data.settings.bot_owner_ids && this.data.settings.bot_owner_ids.length > 0
          ? this.data.settings.bot_owner_ids
          : ['724118793']);

    return {
      ...this.data.settings,
      bot_token: envToken || this.data.settings.bot_token || '',
      bot_owner_ids: currentOwners,
      timezone: process.env.DEFAULT_TIMEZONE || this.data.settings.timezone || 'Asia/Kolkata',
      studio_credit: STUDIO_CREDIT,
      channels_count: this.data.channels.length,
      animes_count: this.data.animes.length,
      active_schedules_count: this.data.scheduled_posts.filter((s) => s.state === 'PENDING').length,
    };
  }

  public updateSettings(updates: Partial<BotSettings>): BotSettings {
    this.data.settings = {
      ...this.data.settings,
      ...updates,
      studio_credit: STUDIO_CREDIT,
    };
    this.saveToDisk();
    return this.getSettings();
  }

  // --- BROADCAST LOGS ---
  public addBroadcastLog(message: string, sentCount: number, failedCount: number): BroadcastLog {
    const log: BroadcastLog = {
      id: `BC_${Date.now()}`,
      message,
      sent_count: sentCount,
      failed_count: failedCount,
      timestamp: new Date().toISOString(),
    };
    this.data.broadcast_logs.unshift(log);
    this.saveToDisk();
    return log;
  }

  public getBroadcastLogs(): BroadcastLog[] {
    return this.data.broadcast_logs;
  }
}

export const db = new Database();

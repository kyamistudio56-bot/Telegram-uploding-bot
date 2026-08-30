export type PostType = 'single_episode' | 'episode_range' | 'movie';

export type ScheduleState = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';

export interface Anime {
  id: string;
  name: string;
  poster: string; // Telegram file_id or image URL / base64
  caption: string; // Exact immutable caption
  episodes_posted: number;
  last_posted_episode: string;
  created_at: string;
  updated_at: string;
}

export interface AnimeChannelLink {
  id: string;
  anime_id: string;
  channel_id: string;
  episode_url: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'disabled';
}

export interface ChannelButton {
  text: string;
  url: string;
}

export interface Channel {
  id: string; // Internal id e.g. "channel_1", "channel_2"
  channel_id: string; // Telegram channel chat ID e.g. "-100xxxxxxxxxx" or "@channel"
  telegram_channel_id?: string; // Explicit alias for channel destination chat ID
  name: string;
  is_enabled: boolean;
  buttons_row2: ChannelButton[];
  created_at: string;
  updated_at: string;
}

export interface ScheduledPost {
  id: string;
  anime_id: string;
  anime_name: string;
  post_type: PostType;
  episode_range: string; // e.g. "03", "02-03", "12-23", "Full Movie"
  custom_channel_links?: Record<string, string>; // channel_id -> custom url override
  scheduled_time: string; // ISO 8601 UTC timestamp
  scheduled_time_display: string; // Display in IST (Asia/Kolkata)
  state: ScheduleState;
  error_message?: string;
  created_by: string;
  created_at: string;
  completed_at?: string;
}

export interface PostingHistory {
  id: string;
  anime_id: string;
  anime_name: string;
  post_type: PostType;
  episode_range: string;
  channel_id: string;
  channel_name: string;
  episode_url: string;
  telegram_message_id?: string | number;
  posted_at: string;
  status: 'POSTED' | 'FAILED';
  error?: string;
}

export interface BotSettings {
  bot_token: string;
  bot_owner_ids: string[]; // Numeric Telegram User IDs
  timezone: string; // e.g. "Asia/Kolkata"
  is_polling: boolean;
  webhook_url?: string;
  last_polling_error?: string;
  studio_credit: string;
  channels_count?: number;
  animes_count?: number;
  active_schedules_count?: number;
}

export interface BroadcastLog {
  id: string;
  message: string;
  sent_count: number;
  failed_count: number;
  timestamp: string;
}

export interface TelegramSimulationMessage {
  id: string;
  sender: 'user' | 'bot';
  text?: string;
  photo?: string;
  reply_markup?: {
    inline_keyboard?: Array<Array<{ text: string; callback_data?: string; url?: string }>>;
  };
  timestamp: string;
}

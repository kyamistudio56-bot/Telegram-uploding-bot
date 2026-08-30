import { db } from './db';
import { Anime, PostType, ScheduledPost, TelegramSimulationMessage } from '../src/types';
import { formatEpisodeButtonText, parseScheduleInput, STUDIO_CREDIT, formatToISTDisplay } from '../src/utils/formatter';

/**
 * Normalizes Telegram channel chat target:
 * - https://t.me/c/1234567890/55 -> -1001234567890
 * - https://t.me/channel_name -> @channel_name
 * - t.me/channel_name -> @channel_name
 * - raw positive digits 1234567890 (length >= 9) -> -1001234567890
 */
export function normalizeTelegramChatId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim().replace(/^['"]|['"]$/g, '');

  // Check for Telegram private web link format: https://t.me/c/1234567890/123
  const cMatch = trimmed.match(/(?:https?:\/\/)?t\.me\/c\/(\d+)(?:\/\d+)?/i);
  if (cMatch) {
    return `-100${cMatch[1]}`;
  }

  // Check for Telegram public channel URL: https://t.me/ChannelUsername
  const tmeMatch = trimmed.match(/(?:https?:\/\/)?t\.me\/([a-zA-Z0-9_]+)(?:\/.*)?$/i);
  if (tmeMatch && !trimmed.includes('?start=')) {
    return `@${tmeMatch[1]}`;
  }

  // If already starts with @ or -
  if (trimmed.startsWith('@') || trimmed.startsWith('-')) {
    return trimmed;
  }

  // If raw numbers >= 9 digits without sign, supergroups/channels start with -100
  if (/^\d{9,}$/.test(trimmed)) {
    return `-100${trimmed}`;
  }

  return trimmed;
}

interface UserSession {
  step: string;
  data: Record<string, any>;
  lastMessageId?: number;
}

const userSessions = new Map<string, UserSession>();

export class TelegramService {
  private pollingActive = false;
  private pollingAbortController: AbortController | null = null;
  private lastUpdateId = 0;
  private isStarting = false;

  public getBotToken(): string {
    const envToken = process.env.BOT_TOKEN?.trim();
    if (envToken) return envToken;
    const settings = db.getSettings();
    return settings.bot_token?.trim() || '';
  }

  public getOwnerIds(): string[] {
    const envOwners = process.env.BOT_OWNER_IDS
      ? process.env.BOT_OWNER_IDS.split(',').map((s) => s.trim().replace(/[^\d]/g, '')).filter(Boolean)
      : [];
    if (envOwners.length > 0) return envOwners;
    const settings = db.getSettings();
    return (settings.bot_owner_ids || []).map((s) => String(s).trim().replace(/[^\d]/g, '')).filter(Boolean);
  }

  public isAuthorized(userId: string | number): boolean {
    const strId = String(userId).trim().replace(/[^\d]/g, '');
    if (!strId) return false;
    const ownerIds = this.getOwnerIds();
    if (ownerIds.length === 0) return false;
    return ownerIds.includes(strId);
  }

  public isPollingActive(): boolean {
    return this.pollingActive;
  }

  // --- TELEGRAM WEBHOOK METHODS ---
  public async setWebhook(url: string, secretToken?: string): Promise<any> {
    const payload: Record<string, any> = {
      url,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    };
    if (secretToken) {
      payload.secret_token = secretToken;
    }
    const res = await this.callApi('setWebhook', payload);
    // When webhook is active, stop polling loop
    this.stopPolling();
    db.updateSettings({ is_polling: false, webhook_url: url });
    return res;
  }

  public async deleteWebhook(dropPendingUpdates = false): Promise<any> {
    const res = await this.callApi('deleteWebhook', { drop_pending_updates: dropPendingUpdates });
    db.updateSettings({ webhook_url: '' });
    return res;
  }

  public async getWebhookInfo(): Promise<any> {
    return this.callApi('getWebhookInfo', {});
  }

  public async initBotService(options?: { webhookUrl?: string; webhookSecret?: string }): Promise<void> {
    const token = this.getBotToken();
    if (!token) {
      console.log('[Telegram Bot] ℹ️ BOT_TOKEN is not set in environment variables. Telegram service waiting for token configuration.');
      return;
    }

    const webhookUrl = options?.webhookUrl || process.env.TELEGRAM_WEBHOOK_URL || process.env.WEBHOOK_URL;
    const webhookSecret = options?.webhookSecret || process.env.TELEGRAM_WEBHOOK_SECRET;

    if (webhookUrl && webhookUrl.startsWith('https://')) {
      console.log(`[Telegram Bot] 🌐 Configuring Telegram Webhook mode with URL: ${webhookUrl}`);
      try {
        await this.setWebhook(webhookUrl, webhookSecret);
        console.log('[Telegram Bot] ✅ Webhook successfully configured with Telegram API.');
      } catch (err: any) {
        console.error('[Telegram Bot] ❌ Webhook registration failed:', err.message);
        console.log('[Telegram Bot] 🔄 Falling back to single active polling worker...');
        await this.startPolling();
      }
    } else {
      console.log('[Telegram Bot] 🔄 Starting single active polling worker...');
      await this.startPolling();
    }
  }

  // --- TELEGRAM BOT API CALLS ---
  public async callApi(method: string, payload: Record<string, any>): Promise<any> {
    const token = this.getBotToken();
    if (!token) {
      throw new Error('Telegram Bot Token is not configured. Please set BOT_TOKEN in environment variables.');
    }

    const url = `https://api.telegram.org/bot${token}/${method}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.description || `Telegram API error on ${method}`);
    }
    return data.result;
  }

  public async getMe(): Promise<any> {
    return this.callApi('getMe', {});
  }

  /**
   * Diagnostic Channel Verification
   * Tests whether the destination Telegram Channel exists, whether the bot is a member,
   * whether the bot is an Administrator, and whether it has 'can_post_messages' permission.
   */
  public async testChannel(channelTarget: string): Promise<{
    success: boolean;
    target: string;
    resolvedChatId?: string | number;
    chatTitle?: string;
    chatUsername?: string;
    chatType?: string;
    isAdmin?: boolean;
    canPost?: boolean;
    reason?: string;
    message: string;
    details?: string;
  }> {
    try {
      const token = this.getBotToken();
      if (!token) {
        return {
          success: false,
          target: channelTarget,
          reason: 'No Bot Token configured',
          message: 'Telegram Bot Token is missing. Please configure BOT_TOKEN in settings or environment.',
        };
      }

      const normalized = normalizeTelegramChatId(channelTarget);
      if (!normalized) {
        return {
          success: false,
          target: channelTarget,
          reason: 'Empty Channel ID',
          message: 'Channel Chat ID is empty or invalid.',
        };
      }

      let chat: any = null;
      try {
        chat = await this.callApi('getChat', { chat_id: normalized });
      } catch (err: any) {
        // Fallback check: if user entered raw positive digits (e.g. 2345678901), try with -100 prefix
        if (/^\d+$/.test(normalized)) {
          try {
            chat = await this.callApi('getChat', { chat_id: `-100${normalized}` });
          } catch {
            // keep original error
          }
        }

        if (!chat) {
          return {
            success: false,
            target: channelTarget,
            reason: 'Telegram chat not found',
            message: `Telegram returned: "${err.message || 'Chat not found'}".`,
            details: `Ensure the Bot has been added as an Administrator to this channel, or check that the Channel Chat ID (e.g. -100xxxxxxxxxx or @channelname) is correct.`,
          };
        }
      }

      const me = await this.getMe();
      let member: any = null;
      try {
        member = await this.callApi('getChatMember', { chat_id: chat.id, user_id: me.id });
      } catch (err: any) {
        const errMsg = err.message || '';
        const isNotAdmin = errMsg.includes('member list is inaccessible') || errMsg.includes('not a member') || errMsg.includes('chat not found');
        return {
          success: false,
          target: channelTarget,
          resolvedChatId: chat.id,
          chatTitle: chat.title || chat.username,
          chatType: chat.type,
          isAdmin: false,
          canPost: false,
          reason: isNotAdmin ? 'Bot is not an administrator in the channel' : 'Cannot query bot membership',
          message: `Bot is in "${chat.title || normalized}" but is not recognized as an Administrator.`,
          details: `Open Telegram channel settings -> Administrators -> Add @${me.username || 'your bot'} as an Admin with "Post Messages" permission.`,
        };
      }

      const isAdmin = member.status === 'administrator' || member.status === 'creator';
      const canPost = member.status === 'creator' || member.can_post_messages !== false;

      if (!isAdmin) {
        return {
          success: false,
          target: channelTarget,
          resolvedChatId: chat.id,
          chatTitle: chat.title || chat.username,
          chatType: chat.type,
          isAdmin: false,
          canPost: false,
          reason: 'Bot is not an administrator',
          message: `Bot is in "${chat.title || normalized}" but has NOT been promoted to Administrator.`,
          details: `Open Telegram channel settings -> Administrators -> Add @${me.username} as an Admin with "Post Messages" permission.`,
        };
      }

      if (!canPost) {
        return {
          success: false,
          target: channelTarget,
          resolvedChatId: chat.id,
          chatTitle: chat.title || chat.username,
          chatType: chat.type,
          isAdmin: true,
          canPost: false,
          reason: 'Posting permission missing',
          message: `Bot is an Admin in "${chat.title || normalized}" but lacks "Post Messages" permission.`,
          details: `Enable "Post Messages" in Administrator permissions for @${me.username}.`,
        };
      }

      return {
        success: true,
        target: channelTarget,
        resolvedChatId: chat.id,
        chatTitle: chat.title || chat.username,
        chatUsername: chat.username ? `@${chat.username}` : undefined,
        chatType: chat.type,
        isAdmin: true,
        canPost: true,
        message: `Connected to "${chat.title || normalized}" with full posting rights.`,
      };
    } catch (err: any) {
      return {
        success: false,
        target: channelTarget,
        reason: 'Verification error',
        message: err.message || 'Failed to verify channel',
      };
    }
  }

  public async checkChannelPermissions(channelTarget: string): Promise<{
    success: boolean;
    message: string;
    details?: string;
    chatTitle?: string;
    chatId?: string | number;
  }> {
    const res = await this.testChannel(channelTarget);
    return {
      success: res.success,
      message: res.message,
      details: res.details,
      chatTitle: res.chatTitle,
      chatId: res.resolvedChatId,
    };
  }

  public async sendPhoto(chatId: string | number, photo: string, caption: string, replyMarkup?: any): Promise<any> {
    return this.callApi('sendPhoto', {
      chat_id: chatId,
      photo,
      caption,
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    });
  }

  public async sendMessage(chatId: string | number, text: string, replyMarkup?: any): Promise<any> {
    return this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    });
  }

  public async answerCallbackQuery(callbackQueryId: string, text?: string, showAlert = false): Promise<any> {
    return this.callApi('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    });
  }

  // --- PUBLISH POST ENGINE (TWO-CHANNEL POSTING) ---
  public async publishPostToChannels(params: {
    animeId: string;
    postType: PostType;
    episodeRange: string;
    customLinks?: Record<string, string>;
  }): Promise<{ success: boolean; results: any[]; errors: string[] }> {
    const anime = db.getAnime(params.animeId);
    if (!anime) {
      throw new Error(`Anime not found with ID: ${params.animeId}`);
    }

    const channels = db.getChannels().filter((c) => c.is_enabled);
    if (channels.length === 0) {
      throw new Error('No enabled channels configured.');
    }

    const cleanRange = (params.episodeRange || '01').replace(/^(range_|episode_|ep_|episodes_)/i, '').trim();
    const results: any[] = [];
    const errors: string[] = [];
    const buttonText = formatEpisodeButtonText(params.postType, cleanRange);

    for (const ch of channels) {
      // Find permanent link or custom link override strictly for Row 1 Episode Button
      const permanentLink = db.getChannelLink(anime.id, ch.id);
      const customLink = params.customLinks?.[ch.id];
      const episodeUrl = customLink || permanentLink?.episode_url;

      if (!episodeUrl) {
        const errMsg = `❌ <b>${ch.name}</b> (<code>${ch.channel_id}</code>): Missing permanent episode link. Please configure in <i>Manage Episode Links</i>.`;
        errors.push(errMsg);
        db.addPostingHistory({
          anime_id: anime.id,
          anime_name: anime.name,
          post_type: params.postType,
          episode_range: cleanRange,
          channel_id: ch.id,
          channel_name: ch.name,
          episode_url: '',
          status: 'FAILED',
          error: `Missing episode URL for ${ch.name}`,
        });
        continue;
      }

      // Build Channel inline keyboard
      // ROW 1: Dynamic Episode / Movie Button (strictly using episodeUrl)
      const inlineKeyboard: Array<Array<{ text: string; url: string }>> = [
        [{ text: buttonText, url: episodeUrl }],
      ];

      // ROW 2: Channel configured secondary buttons
      if (ch.buttons_row2 && ch.buttons_row2.length > 0) {
        inlineKeyboard.push(ch.buttons_row2.map((b) => ({ text: b.text, url: b.url })));
      }

      const replyMarkup = { inline_keyboard: inlineKeyboard };
      const normalizedTarget = normalizeTelegramChatId(ch.channel_id);

      try {
        const token = this.getBotToken();
        let messageId: number | string = `SIM_${Date.now()}`;

        // If real bot token is configured, send real Telegram post to the channel's chat_id
        if (token) {
          const sent = await this.sendPhoto(normalizedTarget, anime.poster, anime.caption, replyMarkup);
          messageId = sent.message_id;
        }

        results.push({ channel: ch.name, channel_id: ch.channel_id, message_id: messageId, url: episodeUrl, target: normalizedTarget });

        db.addPostingHistory({
          anime_id: anime.id,
          anime_name: anime.name,
          post_type: params.postType,
          episode_range: cleanRange,
          channel_id: ch.id,
          channel_name: ch.name,
          episode_url: episodeUrl,
          telegram_message_id: messageId,
          status: 'POSTED',
        });
      } catch (err: any) {
        const rawErr = err.message || 'Telegram send failure';
        let formattedErr = `❌ <b>${ch.name}</b>\n• <b>Configured Chat ID:</b> <code>${ch.channel_id}</code>\n• <b>Telegram Error:</b> <code>${rawErr}</code>`;
        if (rawErr.includes('chat not found')) {
          formattedErr += `\n• <i>Please verify that this is the correct channel ID and that the bot is an administrator in that exact channel.</i>`;
        }
        errors.push(formattedErr);
        db.addPostingHistory({
          anime_id: anime.id,
          anime_name: anime.name,
          post_type: params.postType,
          episode_range: cleanRange,
          channel_id: ch.id,
          channel_name: ch.name,
          episode_url: episodeUrl,
          status: 'FAILED',
          error: `${ch.name} (ID: ${ch.channel_id}): ${rawErr}`,
        });
      }
    }

    // Update anime stats if at least one posted successfully
    if (results.length > 0) {
      db.updateAnime(anime.id, {
        episodes_posted: (anime.episodes_posted || 0) + 1,
        last_posted_episode: params.postType === 'movie' ? 'Full Movie' : cleanRange,
      });
    }

    return {
      success: results.length > 0,
      results,
      errors,
    };
  }

  // --- TELEGRAM BOT POLLING WORKER ---
  public async startPolling(): Promise<void> {
    if (this.pollingActive || this.isStarting) return;
    this.isStarting = true;

    try {
      const token = this.getBotToken();
      if (!token) {
        console.log('[Telegram Bot] ℹ️ BOT_TOKEN is not set in environment variables. Telegram bot polling paused until token is configured.');
        db.updateSettings({ is_polling: false, last_polling_error: 'BOT_TOKEN is missing' });
        return;
      }

      // Step 1: Verify token connectivity
      let botInfo: any = null;
      try {
        botInfo = await this.getMe();
        console.log(`[Telegram Bot] ✅ Authenticated as @${botInfo.username} (ID: ${botInfo.id})`);
        console.log(`[Telegram Bot] 👑 Authorized Owner IDs: [${this.getOwnerIds().join(', ')}]`);
      } catch (err: any) {
        const safeMsg = err.message || 'Invalid bot token or network issue';
        console.error(`[Telegram Bot] ❌ Connection failed: ${safeMsg}`);
        db.updateSettings({ is_polling: false, last_polling_error: safeMsg });
        return;
      }

      // Step 2: Register command list for Telegram client autocomplete
      try {
        await this.callApi('setMyCommands', {
          commands: [
            { command: 'start', description: 'Open Anime CMS Admin Menu' },
            { command: 'menu', description: 'Open Main Menu' },
            { command: 'cancel', description: 'Cancel current operation' },
          ],
        });
      } catch (err: any) {
        // Non-blocking
      }

      // Step 3: Delete any conflicting webhook so polling works seamlessly
      try {
        await this.callApi('deleteWebhook', { drop_pending_updates: false });
        console.log('[Telegram Bot] ✅ Cleared any active webhook configuration for clean polling.');
      } catch (err: any) {
        console.warn('[Telegram Bot] Webhook cleanup warning:', err.message);
      }

      // Step 4: Launch single background polling loop
      this.pollingActive = true;
      db.updateSettings({ is_polling: true, last_polling_error: undefined });
      this.pollingAbortController = new AbortController();

      console.log('[Telegram Bot] 🚀 Single active polling worker started.');

      (async () => {
        while (this.pollingActive) {
          try {
            const updatesUrl = `https://api.telegram.org/bot${token}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=25&allowed_updates=${encodeURIComponent(JSON.stringify(['message', 'callback_query']))}`;
            const res = await fetch(updatesUrl, { signal: this.pollingAbortController?.signal });
            const json = await res.json();

            if (json.ok && Array.isArray(json.result)) {
              for (const update of json.result) {
                this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
                await this.handleTelegramUpdate(update);
              }
            } else if (json.error_code === 409) {
              console.warn('[Telegram Bot] ⚠️ 409 Conflict: Another polling instance detected. Retrying in 5 seconds...');
              await new Promise((r) => setTimeout(r, 5000));
            } else {
              console.warn('[Telegram Bot] getUpdates response:', json.description || 'Unexpected response');
              await new Promise((r) => setTimeout(r, 2000));
            }
          } catch (err: any) {
            if (err.name === 'AbortError') break;
            console.error('[Telegram Bot] Polling loop notice:', err.message);
            db.updateSettings({ last_polling_error: err.message });
            await new Promise((r) => setTimeout(r, 3000));
          }
        }
        console.log('[Telegram Bot] Polling worker stopped.');
      })();
    } finally {
      this.isStarting = false;
    }
  }

  public stopPolling(): void {
    this.pollingActive = false;
    if (this.pollingAbortController) {
      this.pollingAbortController.abort();
      this.pollingAbortController = null;
    }
    db.updateSettings({ is_polling: false });
    console.log('[Telegram Bot] Polling stopped.');
  }

  // --- TELEGRAM UPDATE DISPATCHER ---
  public async handleTelegramUpdate(update: any): Promise<void> {
    try {
      if (update.message) {
        await this.handleIncomingMessage(update.message);
      } else if (update.callback_query) {
        await this.handleCallbackQuery(update.callback_query);
      }
    } catch (err) {
      console.error('[Telegram Bot] Error handling update:', err);
    }
  }

  private async handleIncomingMessage(msg: any): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id || msg.chat?.id;
    const rawText = msg.text?.trim() || '';
    const text = rawText.split('@')[0].trim(); // Normalize /start@botname -> /start

    // Authorization check
    if (!this.isAuthorized(userId)) {
      await this.sendMessage(
        chatId,
        `⛔ <b>Access Restricted</b>\n\nYour Telegram User ID is: <code>${userId}</code>\nPlease ask the bot administrator to authorize your ID in <code>BOT_OWNER_IDS</code>.\n\n<i>${STUDIO_CREDIT}</i>`
      );
      return;
    }

    const sessionKey = `${chatId}`;
    const session = userSessions.get(sessionKey);

    // Global /start or /menu command matching
    if (text === '/start' || text.startsWith('/start ') || text === '/menu' || text.startsWith('/menu ')) {
      userSessions.delete(sessionKey);
      await this.sendMainMenu(chatId);
      return;
    }

    // Global /cancel command
    if (text === '/cancel' || text.startsWith('/cancel ')) {
      userSessions.delete(sessionKey);
      await this.sendMessage(chatId, '❌ Action cancelled.', {
        inline_keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'cmd_main_menu' }]],
      });
      return;
    }

    // Handle forwarded messages from a channel (for instant channel configuration!)
    const forwardChat = msg.forward_from_chat || (msg.forward_origin?.type === 'channel' ? msg.forward_origin.chat : null);
    if (forwardChat) {
      const channels = db.getChannels();
      const detectedId = forwardChat.id;
      const detectedTitle = forwardChat.title || 'Channel';
      const detectedUsername = forwardChat.username ? `@${forwardChat.username}` : 'Private Channel';

      let text =
        `📡 <b>Telegram Channel Detected from Forwarded Post!</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏷 <b>Channel Title:</b> ${detectedTitle}\n` +
        `🆔 <b>Telegram Chat ID:</b> <code>${detectedId}</code>\n` +
        `🔗 <b>Username:</b> ${detectedUsername}\n\n` +
        `Select which channel configuration to update with this Chat ID:`;

      const keyboard: any[] = [];
      channels.forEach((ch) => {
        keyboard.push([
          {
            text: `📺 Set as ${ch.name}`,
            callback_data: `assign_forward_${ch.id}_${detectedId}`,
          },
        ]);
      });
      keyboard.push([
        { text: `🔍 Test Permissions for ID (${detectedId})`, callback_data: `test_raw_chat_${detectedId}` },
      ]);
      keyboard.push([{ text: '🔙 Cancel', callback_data: 'cmd_channels' }]);

      await this.sendMessage(chatId, text, { inline_keyboard: keyboard });
      return;
    }

    // Handle Wizard Session Steps
    if (session) {
      await this.processSessionStep(chatId, userId, session, msg);
      return;
    }

    // Default fallback to main menu
    await this.sendMainMenu(chatId);
  }

  private async handleCallbackQuery(cq: any): Promise<void> {
    const chatId = cq.message?.chat?.id;
    const userId = cq.from?.id;
    const data = cq.data || '';

    if (!chatId) return;

    if (!this.isAuthorized(userId)) {
      await this.answerCallbackQuery(cq.id, '⛔ You are not authorized to use this bot.', true);
      return;
    }

    await this.answerCallbackQuery(cq.id);

    // Route callback actions
    if (data === 'cmd_main_menu') {
      userSessions.delete(`${chatId}`);
      await this.sendMainMenu(chatId);
    } else if (data === 'cmd_add_anime') {
      userSessions.set(`${chatId}`, { step: 'ADD_ANIME_NAME', data: {} });
      await this.sendMessage(
        chatId,
        '➕ <b>Add New Anime</b> (Step 1/5)\n\nPlease enter the <b>Anime Name</b>:\n\n<i>Send /cancel at any time to abort.</i>'
      );
    } else if (data === 'cmd_my_animes' || data.startsWith('page_animes_')) {
      const page = data.startsWith('page_animes_') ? parseInt(data.replace('page_animes_', ''), 10) : 1;
      await this.sendAnimesList(chatId, page);
    } else if (data.startsWith('view_anime_')) {
      const animeId = data.replace('view_anime_', '');
      await this.sendAnimeDashboard(chatId, animeId);
    } else if (data.startsWith('links_anime_')) {
      const animeId = data.replace('links_anime_', '');
      await this.sendEpisodeLinksMenu(chatId, animeId);
    } else if (data.startsWith('edit_link_')) {
      // Format: edit_link_ANM0001_channel_1
      const parts = data.replace('edit_link_', '').split('_');
      const animeId = parts[0];
      const channelId = parts.slice(1).join('_');
      userSessions.set(`${chatId}`, {
        step: 'SET_CHANNEL_LINK',
        data: { animeId, channelId },
      });
      const anime = db.getAnime(animeId);
      const ch = db.getChannel(channelId);
      await this.sendMessage(
        chatId,
        `🔗 <b>Edit Saved Episode Link</b>\n\n<b>Anime:</b> ${anime?.name}\n<b>Channel:</b> ${ch?.name}\n\nEnter the new permanent URL (e.g. <code>https://t.me/yourbot?start=...</code>):`
      );
    } else if (data.startsWith('remove_link_')) {
      const parts = data.replace('remove_link_', '').split('_');
      const animeId = parts[0];
      const channelId = parts.slice(1).join('_');
      db.deleteChannelLink(animeId, channelId);
      await this.sendEpisodeLinksMenu(chatId, animeId);
    } else if (data === 'cmd_post_episode') {
      await this.sendPostSelectAnime(chatId);
    } else if (data.startsWith('post_anime_')) {
      const animeId = data.replace('post_anime_', '');
      await this.sendPostTypeSelection(chatId, animeId);
    } else if (data.startsWith('post_type_')) {
      // Format: post_type_ANM0001_single_episode or movie
      const parts = data.replace('post_type_', '').split('_');
      const animeId = parts[0];
      const postType = parts.slice(1).join('_') as PostType;

      if (postType === 'movie') {
        await this.sendPostPreview(chatId, animeId, 'movie', 'Full Movie');
      } else {
        userSessions.set(`${chatId}`, {
          step: 'POST_EPISODE_INPUT',
          data: { animeId, postType },
        });
        await this.sendMessage(
          chatId,
          `📺 <b>Enter Episode Number or Range</b>\n\nExamples:\n• Single: <code>03</code>\n• Range: <code>02-03</code>\n• Wide Range: <code>12-23</code>`
        );
      }
    } else if (data.startsWith('exec_post_now_')) {
      const rawPayload = data.replace('exec_post_now_', '');
      let animeId = '';
      let postType: PostType = 'single_episode';
      let episodeRange = '01';

      if (rawPayload.includes('::')) {
        const parts = rawPayload.split('::');
        animeId = parts[0];
        postType = parts[1] as PostType;
        episodeRange = parts[2] || '01';
      } else {
        const parts = rawPayload.split('_');
        animeId = parts[0];
        if (rawPayload.includes('_episode_range_')) {
          postType = 'episode_range';
          episodeRange = rawPayload.split('_episode_range_')[1];
        } else if (rawPayload.includes('_single_episode_')) {
          postType = 'single_episode';
          episodeRange = rawPayload.split('_single_episode_')[1];
        } else if (rawPayload.includes('_movie_')) {
          postType = 'movie';
          episodeRange = 'Full Movie';
        } else {
          postType = parts[1] as PostType;
          episodeRange = parts.slice(2).join('_');
        }
      }
      episodeRange = episodeRange.replace(/^(range_|episode_|ep_|episodes_)/i, '').trim();

      await this.sendMessage(chatId, '🚀 Publishing post to all enabled channels...');
      const result = await this.publishPostToChannels({
        animeId,
        postType,
        episodeRange,
      });

      let summary = '';
      if (result.results.length > 0) {
        summary += `✅ <b>Posted Successfully:</b>\n\n` +
          result.results.map((r: any) => `• ✅ <b>${r.channel}</b> (Message ID: <code>${r.message_id}</code>)`).join('\n') + '\n\n';
      }
      if (result.errors.length > 0) {
        summary += `⚠️ <b>Channel Posting Errors:</b>\n\n` +
          result.errors.join('\n\n') + '\n\n';
      }
      summary += `<i>${STUDIO_CREDIT}</i>`;

      const actionButtons: any[] = [];
      if (result.errors.length > 0) {
        const enabledChannels = db.getChannels().filter((c) => c.is_enabled);
        enabledChannels.forEach((ch) => {
          if (result.errors.some((e: string) => e.includes(ch.name) || e.includes(ch.channel_id))) {
            actionButtons.push([
              { text: `✏ Edit ${ch.name} Chat ID`, callback_data: `edit_chid_${ch.id}` },
              { text: `🔍 Test ${ch.name}`, callback_data: `test_ch_${ch.id}` },
            ]);
          }
        });
      }
      actionButtons.push([{ text: '📤 Post Another', callback_data: 'cmd_post_episode' }]);
      actionButtons.push([{ text: '🔙 Main Menu', callback_data: 'cmd_main_menu' }]);

      await this.sendMessage(chatId, summary, { inline_keyboard: actionButtons });
    } else if (data.startsWith('exec_schedule_')) {
      const rawPayload = data.replace('exec_schedule_', '');
      let animeId = '';
      let postType: PostType = 'single_episode';
      let episodeRange = '01';

      if (rawPayload.includes('::')) {
        const parts = rawPayload.split('::');
        animeId = parts[0];
        postType = parts[1] as PostType;
        episodeRange = parts[2] || '01';
      } else {
        const parts = rawPayload.split('_');
        animeId = parts[0];
        if (rawPayload.includes('_episode_range_')) {
          postType = 'episode_range';
          episodeRange = rawPayload.split('_episode_range_')[1];
        } else if (rawPayload.includes('_single_episode_')) {
          postType = 'single_episode';
          episodeRange = rawPayload.split('_single_episode_')[1];
        } else if (rawPayload.includes('_movie_')) {
          postType = 'movie';
          episodeRange = 'Full Movie';
        } else {
          postType = parts[1] as PostType;
          episodeRange = parts.slice(2).join('_');
        }
      }
      episodeRange = episodeRange.replace(/^(range_|episode_|ep_|episodes_)/i, '').trim();

      userSessions.set(`${chatId}`, {
        step: 'ENTER_SCHEDULE_TIME',
        data: { animeId, postType, episodeRange },
      });

      await this.sendMessage(
        chatId,
        `📅 <b>Schedule Post</b>\n\nEnter the schedule time:\n• <code>10m</code>, <code>30m</code>, <code>2h</code>, <code>1d</code>\n• <code>21:00</code> (Today/Tomorrow IST)\n• <code>2026-08-15 21:00</code>\n\n<i>Timezone: Asia/Kolkata (IST)</i>`
      );
    } else if (data === 'cmd_scheduled_posts') {
      await this.sendScheduledPostsList(chatId);
    } else if (data.startsWith('view_sched_')) {
      const schedId = data.replace('view_sched_', '');
      await this.sendScheduleDetail(chatId, schedId);
    } else if (data.startsWith('confirm_postnow_sched_')) {
      const schedId = data.replace('confirm_postnow_sched_', '');
      await this.sendPostNowConfirmation(chatId, schedId);
    } else if (data.startsWith('do_postnow_sched_')) {
      const schedId = data.replace('do_postnow_sched_', '');
      await this.executePostNowSchedule(chatId, schedId);
    } else if (data.startsWith('resched_')) {
      const schedId = data.replace('resched_', '');
      userSessions.set(`${chatId}`, {
        step: 'RESCHEDULE_INPUT',
        data: { schedId },
      });
      await this.sendMessage(
        chatId,
        `✏ <b>Reschedule Post</b>\n\nEnter the new scheduled time (e.g. <code>30m</code>, <code>22:00</code>, or <code>2026-08-15 22:30</code>):`
      );
    } else if (data.startsWith('del_sched_')) {
      const schedId = data.replace('del_sched_', '');
      db.deleteScheduledPost(schedId);
      await this.sendMessage(chatId, '🗑 Scheduled post deleted.');
      await this.sendScheduledPostsList(chatId);
    } else if (data === 'cmd_channels') {
      await this.sendChannelsList(chatId);
    } else if (data === 'test_all_channels') {
      await this.sendAllChannelsDiagnosticReport(chatId);
    } else if (data.startsWith('manage_ch_')) {
      const channelId = data.replace('manage_ch_', '');
      await this.sendChannelDetail(chatId, channelId);
    } else if (data.startsWith('test_ch_')) {
      const channelId = data.replace('test_ch_', '');
      await this.sendChannelDiagnosticReport(chatId, channelId);
    } else if (data.startsWith('test_raw_chat_')) {
      const rawId = data.replace('test_raw_chat_', '');
      await this.sendRawChatDiagnosticReport(chatId, rawId);
    } else if (data.startsWith('edit_chid_')) {
      const channelId = data.replace('edit_chid_', '');
      const ch = db.getChannel(channelId);
      userSessions.set(`${chatId}`, {
        step: 'EDIT_CHANNEL_CHAT_ID',
        data: { channelId },
      });
      await this.sendMessage(
        chatId,
        `✏ <b>Edit Telegram Channel ID for: ${ch?.name}</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Current Chat ID: <code>${ch?.channel_id}</code>\n\n` +
          `Please choose ONE of the following options:\n` +
          `1. <b>Forward any post</b> from your Telegram channel directly to this bot.\n` +
          `2. <b>Type the Channel Chat ID</b> (e.g. <code>-1002345678901</code> or public <code>@yourchannel</code>).\n\n` +
          `<i>Send /cancel to return to menu.</i>`
      );
    } else if (data.startsWith('edit_chname_')) {
      const channelId = data.replace('edit_chname_', '');
      const ch = db.getChannel(channelId);
      userSessions.set(`${chatId}`, {
        step: 'EDIT_CHANNEL_NAME',
        data: { channelId },
      });
      await this.sendMessage(
        chatId,
        `✏ <b>Edit Channel Name</b>\n\nCurrent Name: <b>${ch?.name}</b>\n\nEnter the new channel display name:`
      );
    } else if (data.startsWith('toggle_ch_')) {
      const channelId = data.replace('toggle_ch_', '');
      const ch = db.getChannel(channelId);
      if (ch) {
        db.updateChannel(channelId, { is_enabled: !ch.is_enabled });
      }
      await this.sendChannelDetail(chatId, channelId);
    } else if (data.startsWith('assign_forward_')) {
      // Format: assign_forward_channel_1_-1002345678901
      const parts = data.replace('assign_forward_', '').split('_');
      const channelId = `${parts[0]}_${parts[1]}`;
      const forwardId = parts.slice(2).join('_');
      
      const ch = db.getChannel(channelId);
      if (ch) {
        db.updateChannel(channelId, { channel_id: forwardId });
        await this.sendMessage(chatId, `✅ <b>${ch.name}</b> updated to Chat ID: <code>${forwardId}</code>`);
        await this.sendChannelDiagnosticReport(chatId, channelId);
      }
    } else if (data.startsWith('save_resolved_chid_')) {
      // Format: save_resolved_chid_channel_1_-1002345678901
      const parts = data.replace('save_resolved_chid_', '').split('_');
      const channelId = `${parts[0]}_${parts[1]}`;
      const resolvedId = parts.slice(2).join('_');
      const ch = db.getChannel(channelId);
      if (ch) {
        db.updateChannel(channelId, { channel_id: resolvedId });
        await this.sendMessage(chatId, `✅ Saved canonical numeric ID <code>${resolvedId}</code> for <b>${ch.name}</b>.`);
        await this.sendChannelDetail(chatId, channelId);
      }
    } else if (data === 'cmd_settings') {
      await this.sendSettingsMenu(chatId);
    } else if (data === 'cmd_broadcast') {
      userSessions.set(`${chatId}`, { step: 'BROADCAST_INPUT', data: {} });
      await this.sendMessage(chatId, '📢 <b>Broadcast Message</b>\n\nEnter message to broadcast to channels:');
    }
  }

  // --- WIZARD STEPS PROCESSOR ---
  private async processSessionStep(chatId: number, userId: number, session: UserSession, msg: any): Promise<void> {
    const text = msg.text?.trim() || '';

    switch (session.step) {
      case 'EDIT_CHANNEL_CHAT_ID': {
        const { channelId } = session.data;
        const forwardChat = msg.forward_from_chat || (msg.forward_origin?.type === 'channel' ? msg.forward_origin.chat : null);
        const inputId = forwardChat ? String(forwardChat.id) : text;

        if (!inputId) {
          await this.sendMessage(chatId, 'Please enter a valid Chat ID or forward a post from the channel:');
          return;
        }

        const normalized = normalizeTelegramChatId(inputId);
        const ch = db.getChannel(channelId);
        if (!ch) {
          userSessions.delete(`${chatId}`);
          await this.sendChannelsList(chatId);
          return;
        }

        db.updateChannel(channelId, { channel_id: normalized });
        userSessions.delete(`${chatId}`);

        await this.sendMessage(chatId, `💾 Updated <b>${ch.name}</b> destination Chat ID to <code>${normalized}</code>.\nRunning diagnostic verification...`);
        await this.sendChannelDiagnosticReport(chatId, channelId);
        break;
      }

      case 'EDIT_CHANNEL_NAME': {
        const { channelId } = session.data;
        if (!text) {
          await this.sendMessage(chatId, 'Please enter a non-empty name:');
          return;
        }
        db.updateChannel(channelId, { name: text });
        userSessions.delete(`${chatId}`);
        await this.sendMessage(chatId, `✅ Channel renamed to <b>${text}</b>.`);
        await this.sendChannelDetail(chatId, channelId);
        break;
      }
      case 'ADD_ANIME_NAME': {
        if (!text) {
          await this.sendMessage(chatId, 'Please enter a valid Anime Name:');
          return;
        }
        session.data.name = text;
        session.step = 'ADD_ANIME_POSTER';
        await this.sendMessage(
          chatId,
          `➕ <b>Add Anime: ${text}</b> (Step 2/5)\n\nPlease send the <b>Poster Image</b> (photo or image URL):`
        );
        break;
      }

      case 'ADD_ANIME_POSTER': {
        let posterUrl = text;
        if (msg.photo && msg.photo.length > 0) {
          // Highest resolution photo file_id
          const highestPhoto = msg.photo[msg.photo.length - 1];
          posterUrl = highestPhoto.file_id;
        }

        if (!posterUrl) {
          await this.sendMessage(chatId, 'Please send a photo or a valid image URL:');
          return;
        }

        session.data.poster = posterUrl;
        session.step = 'ADD_ANIME_CAPTION';
        await this.sendMessage(
          chatId,
          `➕ <b>Add Anime</b> (Step 3/5)\n\nPlease send the <b>Complete Caption</b>:\n\n<i>Note: The caption is stored exactly as sent.</i>`
        );
        break;
      }

      case 'ADD_ANIME_CAPTION': {
        if (!text) {
          await this.sendMessage(chatId, 'Please provide the caption text:');
          return;
        }
        session.data.caption = text;
        session.step = 'ADD_ANIME_LINK_CH1';
        await this.sendMessage(
          chatId,
          `➕ <b>Permanent Episode Link: Channel 1</b> (Step 4/5)\n\nEnter Channel 1 download URL (or send <code>skip</code>):`
        );
        break;
      }

      case 'ADD_ANIME_LINK_CH1': {
        if (text.toLowerCase() !== 'skip') {
          session.data.linkCh1 = text;
        }
        session.step = 'ADD_ANIME_LINK_CH2';
        await this.sendMessage(
          chatId,
          `➕ <b>Permanent Episode Link: Channel 2</b> (Step 5/5)\n\nEnter Channel 2 download URL (or send <code>skip</code>):`
        );
        break;
      }

      case 'ADD_ANIME_LINK_CH2': {
        if (text.toLowerCase() !== 'skip') {
          session.data.linkCh2 = text;
        }

        // Create the Anime in database
        const newAnime = db.createAnime({
          name: session.data.name,
          poster: session.data.poster,
          caption: session.data.caption,
        });

        // Save permanent links
        const channels = db.getChannels();
        if (session.data.linkCh1 && channels[0]) {
          db.saveChannelLink(newAnime.id, channels[0].id, session.data.linkCh1);
        }
        if (session.data.linkCh2 && channels[1]) {
          db.saveChannelLink(newAnime.id, channels[1].id, session.data.linkCh2);
        }

        userSessions.delete(`${chatId}`);

        await this.sendMessage(
          chatId,
          `✅ <b>Anime Added Successfully!</b>\n\n<b>ID:</b> ${newAnime.id}\n<b>Name:</b> ${newAnime.name}`,
          {
            inline_keyboard: [
              [{ text: '📤 Post Episode Now', callback_data: `post_anime_${newAnime.id}` }],
              [{ text: '🔗 View Episode Links', callback_data: `links_anime_${newAnime.id}` }],
              [{ text: '🔙 Anime Dashboard', callback_data: `view_anime_${newAnime.id}` }],
            ],
          }
        );
        break;
      }

      case 'SET_CHANNEL_LINK': {
        if (!text || !text.startsWith('http')) {
          await this.sendMessage(chatId, 'Please enter a valid URL starting with http:// or https://:');
          return;
        }
        const { animeId, channelId } = session.data;
        db.saveChannelLink(animeId, channelId, text);
        userSessions.delete(`${chatId}`);
        await this.sendMessage(chatId, '✅ Permanent episode link updated!');
        await this.sendEpisodeLinksMenu(chatId, animeId);
        break;
      }

      case 'POST_EPISODE_INPUT': {
        const { animeId, postType } = session.data;
        userSessions.delete(`${chatId}`);
        await this.sendPostPreview(chatId, animeId, postType, text);
        break;
      }

      case 'ENTER_SCHEDULE_TIME': {
        const { animeId, postType, episodeRange } = session.data;
        try {
          const parsed = parseScheduleInput(text);
          const anime = db.getAnime(animeId);
          const sched = db.createScheduledPost({
            anime_id: animeId,
            anime_name: anime?.name || 'Anime',
            post_type: postType,
            episode_range: episodeRange,
            scheduled_time: parsed.date.toISOString(),
            scheduled_time_display: parsed.displayIST,
            created_by: `Telegram (${userId})`,
          });

          userSessions.delete(`${chatId}`);
          await this.sendMessage(
            chatId,
            `📅 <b>Schedule Created!</b>\n\n<b>Anime:</b> ${sched.anime_name}\n<b>Type:</b> ${sched.post_type}\n<b>Range:</b> ${sched.episode_range}\n<b>Scheduled for:</b> ${sched.scheduled_time_display}\n\n<i>${STUDIO_CREDIT}</i>`,
            {
              inline_keyboard: [
                [{ text: '📅 View Scheduled Posts', callback_data: 'cmd_scheduled_posts' }],
                [{ text: '🔙 Main Menu', callback_data: 'cmd_main_menu' }],
              ],
            }
          );
        } catch (err: any) {
          await this.sendMessage(chatId, `⚠️ ${err.message}\nPlease try again:`);
        }
        break;
      }

      case 'RESCHEDULE_INPUT': {
        const { schedId } = session.data;
        try {
          const parsed = parseScheduleInput(text);
          const updated = db.updateScheduledPost(schedId, {
            scheduled_time: parsed.date.toISOString(),
            scheduled_time_display: parsed.displayIST,
            state: 'PENDING',
          });

          userSessions.delete(`${chatId}`);
          await this.sendMessage(
            chatId,
            `✅ <b>Rescheduled Successfully!</b>\n\nNew time: <b>${updated?.scheduled_time_display}</b>`,
            {
              inline_keyboard: [
                [{ text: '📅 Scheduled Posts', callback_data: 'cmd_scheduled_posts' }],
                [{ text: '🔙 Main Menu', callback_data: 'cmd_main_menu' }],
              ],
            }
          );
        } catch (err: any) {
          await this.sendMessage(chatId, `⚠️ ${err.message}\nPlease enter time again:`);
        }
        break;
      }

      case 'BROADCAST_INPUT': {
        const channels = db.getChannels().filter((c) => c.is_enabled);
        let sent = 0;
        let failed = 0;
        for (const ch of channels) {
          try {
            await this.sendMessage(ch.channel_id, text);
            sent++;
          } catch (e) {
            failed++;
          }
        }
        db.addBroadcastLog(text, sent, failed);
        userSessions.delete(`${chatId}`);
        await this.sendMessage(chatId, `📢 Broadcast finished. Sent: ${sent}, Failed: ${failed}`);
        await this.sendMainMenu(chatId);
        break;
      }
    }
  }

  // --- MENU RENDERERS ---
  public async sendMainMenu(chatId: number | string): Promise<any> {
    const text =
      `🌸 <b>TELEGRAM ANIME POSTER & EPISODE CMS</b>\n\n` +
      `<b>Status:</b> Online  •  <b>Timezone:</b> Asia/Kolkata (IST)\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Welcome to the Anime Poster & Multi-Episode CMS Bot.\n` +
      `Manage permanent links, ranges, movie posts, and schedules seamlessly.`;

    const replyMarkup = {
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
          { text: '📢 Broadcast', callback_data: 'cmd_broadcast' },
        ],
        [{ text: '⚙ Settings', callback_data: 'cmd_settings' }],
      ],
    };

    return this.sendMessage(chatId, text, replyMarkup);
  }

  public async sendAnimesList(chatId: number | string, page = 1): Promise<any> {
    const allAnimes = db.getAnimes();
    const pageSize = 5;
    const totalPages = Math.ceil(allAnimes.length / pageSize) || 1;
    const currPage = Math.min(Math.max(1, page), totalPages);
    const startIdx = (currPage - 1) * pageSize;
    const pageItems = allAnimes.slice(startIdx, startIdx + pageSize);

    let text = `📚 <b>My Animes</b> (Page ${currPage}/${totalPages})\n\n`;
    if (pageItems.length === 0) {
      text += '<i>No anime added yet. Click Add Anime below!</i>\n';
    }

    const keyboard: any[] = [];
    for (const anime of pageItems) {
      keyboard.push([
        {
          text: `🎬 ${anime.name} (${anime.last_posted_episode !== '-' ? `Ep ${anime.last_posted_episode}` : 'No posts'})`,
          callback_data: `view_anime_${anime.id}`,
        },
      ]);
    }

    // Pagination row
    const navRow: any[] = [];
    if (currPage > 1) {
      navRow.push({ text: '⬅️ Previous', callback_data: `page_animes_${currPage - 1}` });
    }
    if (currPage < totalPages) {
      navRow.push({ text: 'Next ➡️', callback_data: `page_animes_${currPage + 1}` });
    }
    if (navRow.length > 0) keyboard.push(navRow);

    keyboard.push([
      { text: '➕ Add Anime', callback_data: 'cmd_add_anime' },
      { text: '🔙 Main Menu', callback_data: 'cmd_main_menu' },
    ]);

    return this.sendMessage(chatId, text, { inline_keyboard: keyboard });
  }

  public async sendAnimeDashboard(chatId: number | string, animeId: string): Promise<any> {
    const anime = db.getAnime(animeId);
    if (!anime) {
      return this.sendMessage(chatId, '⚠️ Anime not found.', {
        inline_keyboard: [[{ text: '🔙 Back', callback_data: 'cmd_my_animes' }]],
      });
    }

    const links = db.getChannelLinks(anime.id);
    const channels = db.getChannels();

    let linksDisplay = '';
    for (const ch of channels) {
      const link = links.find((l) => l.channel_id === ch.id);
      linksDisplay += `📺 <b>${ch.name}:</b>\n   🔗 ${link ? link.episode_url : '<i>⚠️ Not configured</i>'}\n`;
    }

    const text =
      `🎬 <b>${anime.name}</b>\n` +
      `<b>ID:</b> <code>${anime.id}</code>\n` +
      `<b>Episodes Posted:</b> ${anime.episodes_posted || 0}\n` +
      `<b>Last Posted:</b> ${anime.last_posted_episode || '-'}\n` +
      `<b>Date Added:</b> ${formatToISTDisplay(anime.created_at)}\n\n` +
      `<b>📌 Saved Permanent Episode Links:</b>\n${linksDisplay}\n` +
      `<b>📝 Saved Caption Preview:</b>\n<pre>${anime.caption.slice(0, 180)}...</pre>`;

    const keyboard = [
      [{ text: '📤 New Post', callback_data: `post_anime_${anime.id}` }],
      [{ text: '🔗 Manage Episode Links', callback_data: `links_anime_${anime.id}` }],
      [{ text: '🔙 My Animes', callback_data: 'cmd_my_animes' }],
    ];

    return this.sendMessage(chatId, text, { inline_keyboard: keyboard });
  }

  public async sendEpisodeLinksMenu(chatId: number | string, animeId: string): Promise<any> {
    const anime = db.getAnime(animeId);
    if (!anime) return;

    const channels = db.getChannels();
    const links = db.getChannelLinks(anime.id);

    let text = `🔗 <b>Permanent Episode Links</b>\n<b>Anime:</b> ${anime.name}\n\n`;
    const keyboard: any[] = [];

    for (const ch of channels) {
      const l = links.find((item) => item.channel_id === ch.id);
      text += `📺 <b>${ch.name}</b>\n   Current: ${l ? `<code>${l.episode_url}</code>` : '<i>None</i>'}\n\n`;
      keyboard.push([
        { text: `✏ Edit Link: ${ch.name}`, callback_data: `edit_link_${anime.id}_${ch.id}` },
        ...(l ? [{ text: `🗑 Remove`, callback_data: `remove_link_${anime.id}_${ch.id}` }] : []),
      ]);
    }

    keyboard.push([{ text: '🔙 Back to Anime', callback_data: `view_anime_${anime.id}` }]);

    return this.sendMessage(chatId, text, { inline_keyboard: keyboard });
  }

  public async sendPostSelectAnime(chatId: number | string): Promise<any> {
    const animes = db.getAnimes();
    let text = '📤 <b>Select Anime for Episode / Movie Posting:</b>\n\n';
    const keyboard: any[] = [];

    for (const a of animes) {
      keyboard.push([{ text: `🎬 ${a.name}`, callback_data: `post_anime_${a.id}` }]);
    }

    keyboard.push([{ text: '🔙 Main Menu', callback_data: 'cmd_main_menu' }]);
    return this.sendMessage(chatId, text, { inline_keyboard: keyboard });
  }

  public async sendPostTypeSelection(chatId: number | string, animeId: string): Promise<any> {
    const anime = db.getAnime(animeId);
    if (!anime) return;

    const text = `📤 <b>Post to Channels: ${anime.name}</b>\n\nSelect the Post Type:`;
    const keyboard = [
      [
        { text: '📺 Single Episode (e.g. 03)', callback_data: `post_type_${anime.id}_single_episode` },
      ],
      [
        { text: '🔢 Episode Range (e.g. 02-03, 12-23)', callback_data: `post_type_${anime.id}_episode_range` },
      ],
      [
        { text: '🎬 Movie (Full Movie Added)', callback_data: `post_type_${anime.id}_movie` },
      ],
      [{ text: '🔙 Back', callback_data: 'cmd_post_episode' }],
    ];

    return this.sendMessage(chatId, text, { inline_keyboard: keyboard });
  }

  public async sendPostPreview(chatId: number | string, animeId: string, postType: PostType, episodeRange: string): Promise<any> {
    const anime = db.getAnime(animeId);
    if (!anime) return;

    const channels = db.getChannels().filter((c) => c.is_enabled);
    const cleanRange = (episodeRange || '01').replace(/^(range_|episode_|ep_|episodes_)/i, '').trim();
    const buttonText = formatEpisodeButtonText(postType, cleanRange);

    let linksCheck = '';
    let missingLink = false;

    for (const ch of channels) {
      const link = db.getChannelLink(anime.id, ch.id);
      if (link && link.episode_url) {
        linksCheck += `• <b>${ch.name}</b> (<code>${ch.channel_id}</code>)\n  🔗 <i>Episode Link:</i> <code>${link.episode_url}</code>\n`;
      } else {
        linksCheck += `• <b>${ch.name}</b> (<code>${ch.channel_id}</code>)\n  ⚠️ <i>No permanent link configured for this channel!</i>\n`;
        missingLink = true;
      }
    }

    const typeDisplay = postType === 'movie' ? 'Movie' : postType === 'episode_range' ? 'Episode' : 'Episode';
    const previewText =
      `📋 <b>POST PREVIEW</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📚 <b>Anime:</b> ${anime.name}\n` +
      `📌 <b>Type:</b> ${typeDisplay}\n` +
      `📌 <b>Range/Value:</b> ${postType === 'movie' ? 'Full Movie' : cleanRange}\n` +
      `🔘 <b>Formatted Button:</b>\n<code>${buttonText}</code>\n\n` +
      `📺 <b>Channels:</b>\n` +
      channels.map((ch) => `• ${ch.name}`).join('\n') +
      `\n\n` +
      (missingLink
        ? `⚠️ <i>Warning: One or more channels do not have a permanent episode link saved. Please configure links first or add them now.</i>\n\n${linksCheck}`
        : `🔗 <i>Permanent episode links loaded automatically.</i>`);

    const encoded = `${anime.id}::${postType}::${cleanRange}`;
    const keyboard: any[] = [];

    if (missingLink) {
      keyboard.push([{ text: '🔗 Configure Episode Links', callback_data: `links_anime_${anime.id}` }]);
    } else {
      keyboard.push([
        { text: '⚡ Post Now', callback_data: `exec_post_now_${encoded}` },
        { text: '📅 Schedule', callback_data: `exec_schedule_${encoded}` },
      ]);
    }

    keyboard.push([
      { text: '✏ Edit', callback_data: `post_anime_${anime.id}` },
      { text: '❌ Cancel', callback_data: 'cmd_main_menu' },
    ]);

    return this.sendMessage(chatId, previewText, { inline_keyboard: keyboard });
  }

  public async sendScheduledPostsList(chatId: number | string): Promise<any> {
    const schedules = db.getScheduledPosts().filter((s) => s.state === 'PENDING' || s.state === 'PROCESSING');
    let text = `📅 <b>Scheduled Posts</b>\n\n`;

    if (schedules.length === 0) {
      text += '<i>No active scheduled posts.</i>\n';
      return this.sendMessage(chatId, text, {
        inline_keyboard: [
          [{ text: '📤 Schedule a Post', callback_data: 'cmd_post_episode' }],
          [{ text: '🔙 Main Menu', callback_data: 'cmd_main_menu' }],
        ],
      });
    }

    const keyboard: any[] = [];
    schedules.forEach((s, idx) => {
      text += `${idx + 1}. <b>${s.anime_name}</b>\n   ${s.post_type === 'movie' ? 'Full Movie' : `Episode ${s.episode_range}`}\n   🕒 ${s.scheduled_time_display}\n\n`;
      keyboard.push([
        { text: `✏ Edit / Reschedule #${idx + 1}`, callback_data: `resched_${s.id}` },
        { text: `⚡ Post Now #${idx + 1}`, callback_data: `confirm_postnow_sched_${s.id}` },
        { text: `🗑 Delete`, callback_data: `del_sched_${s.id}` },
      ]);
    });

    keyboard.push([{ text: '🔙 Main Menu', callback_data: 'cmd_main_menu' }]);
    return this.sendMessage(chatId, text, { inline_keyboard: keyboard });
  }

  public async sendScheduleDetail(chatId: number | string, schedId: string): Promise<any> {
    const sched = db.getScheduledPost(schedId);
    if (!sched) return;

    const text =
      `📅 <b>Scheduled Post Details</b>\n\n` +
      `<b>Anime:</b> ${sched.anime_name}\n` +
      `<b>Type:</b> ${sched.post_type}\n` +
      `<b>Range:</b> ${sched.episode_range}\n` +
      `<b>Scheduled Time:</b> ${sched.scheduled_time_display}\n` +
      `<b>Status:</b> ${sched.state}\n` +
      `<b>Created By:</b> ${sched.created_by}`;

    const keyboard = [
      [{ text: '⚡ Post Now', callback_data: `confirm_postnow_sched_${sched.id}` }],
      [{ text: '✏ Edit / Reschedule', callback_data: `resched_${sched.id}` }],
      [{ text: '🗑 Delete Schedule', callback_data: `del_sched_${sched.id}` }],
      [{ text: '🔙 Back to Scheduled Posts', callback_data: 'cmd_scheduled_posts' }],
    ];

    return this.sendMessage(chatId, text, { inline_keyboard: keyboard });
  }

  public async sendPostNowConfirmation(chatId: number | string, schedId: string): Promise<any> {
    const sched = db.getScheduledPost(schedId);
    if (!sched) return;

    const text =
      `⚡ <b>Post Now Confirmation</b>\n\n` +
      `Are you sure you want to publish this scheduled post immediately?\n\n` +
      `<b>Anime:</b> ${sched.anime_name}\n` +
      `<b>Range:</b> ${sched.episode_range}\n` +
      `<b>Original Schedule:</b> ${sched.scheduled_time_display}\n\n` +
      `<i>This will atomically mark the schedule as COMPLETED and prevent it from firing later.</i>`;

    const keyboard = [
      [
        { text: '⚡ YES, POST NOW', callback_data: `do_postnow_sched_${sched.id}` },
        { text: '❌ CANCEL', callback_data: 'cmd_scheduled_posts' },
      ],
    ];

    return this.sendMessage(chatId, text, { inline_keyboard: keyboard });
  }

  public async executePostNowSchedule(chatId: number | string, schedId: string): Promise<any> {
    const sched = db.getScheduledPost(schedId);
    if (!sched) return;

    // Atomically claim schedule to prevent race conditions
    const claimed = db.atomicClaimSchedule(schedId);
    if (!claimed) {
      return this.sendMessage(chatId, '⚠️ This schedule is already being processed or completed.');
    }

    await this.sendMessage(chatId, '⚡ Processing instant publication...');

    try {
      const result = await this.publishPostToChannels({
        animeId: sched.anime_id,
        postType: sched.post_type,
        episodeRange: sched.episode_range,
        customLinks: sched.custom_channel_links,
      });

      if (result.success) {
        db.completeSchedule(sched.id);
        await this.sendMessage(
          chatId,
          `✅ <b>Instant Post Completed!</b>\n\n` +
            result.results.map((r: any) => `• <b>${r.channel}</b> (ID: ${r.message_id})`).join('\n') +
            `\n\nScheduled job marked as COMPLETED. It will NOT fire again at ${sched.scheduled_time_display}.\n\n<i>${STUDIO_CREDIT}</i>`,
          {
            inline_keyboard: [[{ text: '📅 Scheduled Posts', callback_data: 'cmd_scheduled_posts' }]],
          }
        );
      } else {
        db.failSchedule(sched.id, result.errors.join(', '));
        await this.sendMessage(chatId, `❌ Post Now Failed:\n${result.errors.join('\n')}`);
      }
    } catch (err: any) {
      db.failSchedule(sched.id, err.message);
      await this.sendMessage(chatId, `❌ Error: ${err.message}`);
    }
  }

  public async sendChannelsList(chatId: number | string): Promise<any> {
    const channels = db.getChannels();
    let text =
      `📺 <b>Telegram Channels Management</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Configure and verify Telegram publishing destinations below.\n\n` +
      `💡 <i>Tip: You can forward any post from your Telegram channel to this bot to automatically detect and assign its Chat ID!</i>\n\n`;

    const keyboard: any[] = [];

    channels.forEach((ch, idx) => {
      text += `${idx + 1}. <b>${ch.name}</b>\n   📍 Destination Chat ID: <code>${ch.channel_id}</code>\n   ⚙ Status: ${ch.is_enabled ? '🟢 Active' : '🔴 Disabled'}\n\n`;
      keyboard.push([
        { text: `🔍 Test ${ch.name}`, callback_data: `test_ch_${ch.id}` },
        { text: `✏ Edit Chat ID`, callback_data: `edit_chid_${ch.id}` },
      ]);
    });

    keyboard.push([
      { text: '🔍 Test All Channels', callback_data: 'test_all_channels' },
    ]);
    keyboard.push([{ text: '🔙 Main Menu', callback_data: 'cmd_main_menu' }]);

    return this.sendMessage(chatId, text, { inline_keyboard: keyboard });
  }

  public async sendAllChannelsDiagnosticReport(chatId: number | string): Promise<any> {
    const channels = db.getChannels();
    await this.sendMessage(chatId, `🔍 Running comprehensive diagnostic test for all ${channels.length} configured channels...`);

    let report = `🔍 <b>ALL CHANNELS DIAGNOSTIC REPORT</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    const keyboard: any[] = [];

    for (const ch of channels) {
      const result = await this.testChannel(ch.channel_id);
      report += `${result.success ? '✅' : '❌'} <b>${ch.name}</b> (${ch.is_enabled ? '🟢 Active' : '🔴 Disabled'})\n`;
      report += `<b>Chat ID:</b> <code>${result.resolvedChatId || result.target}</code>\n`;
      report += `<b>Channel:</b> ${result.chatTitle || ch.name}\n`;
      report += `<b>Bot Access:</b> ${result.resolvedChatId ? '✅' : '❌'}\n`;
      report += `<b>Administrator:</b> ${result.isAdmin ? '✅' : '❌'}\n`;
      report += `<b>Can Post:</b> ${result.canPost ? '✅' : '❌'}\n`;

      if (!result.success) {
        report += `<b>Reason:</b> ${result.reason || result.message}\n`;
      }
      report += `\n`;

      keyboard.push([
        { text: `🔍 Test ${ch.name}`, callback_data: `test_ch_${ch.id}` },
        { text: `✏ Edit ${ch.name} Chat ID`, callback_data: `edit_chid_${ch.id}` },
      ]);
    }

    keyboard.push([{ text: '📺 Channels Menu', callback_data: 'cmd_channels' }]);
    keyboard.push([{ text: '🔙 Main Menu', callback_data: 'cmd_main_menu' }]);

    return this.sendMessage(chatId, report, { inline_keyboard: keyboard });
  }

  public async sendChannelDetail(chatId: number | string, channelId: string): Promise<any> {
    const ch = db.getChannel(channelId);
    if (!ch) return;

    const text =
      `⚙ <b>Channel Settings: ${ch.name}</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🏷 <b>Display Name:</b> ${ch.name}\n` +
      `📍 <b>Destination Chat ID:</b> <code>${ch.channel_id}</code>\n` +
      `📊 <b>Status:</b> ${ch.is_enabled ? '🟢 Enabled (Will receive posts)' : '🔴 Disabled'}\n` +
      `🔘 <b>Row 2 Secondary Buttons:</b> ${ch.buttons_row2?.length || 0} configured\n\n` +
      `<i>Note: The Channel Chat ID is where posts are published. Anime episode download links are configured separately per anime.</i>`;

    const keyboard = [
      [{ text: '🔍 Test Bot Permissions', callback_data: `test_ch_${ch.id}` }],
      [
        { text: '✏ Edit Chat ID / Username', callback_data: `edit_chid_${ch.id}` },
        { text: '✏ Rename Channel', callback_data: `edit_chname_${ch.id}` },
      ],
      [{ text: ch.is_enabled ? '🔴 Disable Channel' : '🟢 Enable Channel', callback_data: `toggle_ch_${ch.id}` }],
      [{ text: '🔙 Back to Channels', callback_data: 'cmd_channels' }],
    ];

    return this.sendMessage(chatId, text, { inline_keyboard: keyboard });
  }

  public async sendChannelDiagnosticReport(chatId: number | string, channelId: string): Promise<any> {
    const ch = db.getChannel(channelId);
    if (!ch) return;

    await this.sendMessage(chatId, `🔍 Testing bot connectivity and permissions for <b>${ch.name}</b> (<code>${ch.channel_id}</code>)...`);

    const result = await this.testChannel(ch.channel_id);

    let text = `${result.success ? '✅' : '❌'} <b>Channel Test ${result.success ? 'Passed' : 'Failed'}</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `<b>Channel:</b> ${result.chatTitle || ch.name}\n`;
    text += `<b>Chat ID:</b> <code>${result.resolvedChatId || result.target}</code>\n`;
    text += `<b>Bot Access:</b> ${result.resolvedChatId ? '✅' : '❌'}\n`;
    text += `<b>Administrator:</b> ${result.isAdmin ? '✅' : '❌'}\n`;
    text += `<b>Can Post:</b> ${result.canPost ? '✅' : '❌'}\n\n`;

    if (result.success) {
      text += `<i>Connected to "${result.chatTitle || ch.name}" with full posting permissions.</i>`;
    } else {
      text += `<b>Reason:</b> ${result.reason || 'Verification Failed'}\n`;
      if (result.details) {
        text += `<b>Action Required:</b> ${result.details}\n`;
      } else {
        text += `<b>Error Details:</b> ${result.message}\n`;
      }
    }

    const keyboard: any[] = [];

    // If channel username was resolved to a numeric ID that differs, offer one-click canonical save
    if (result.resolvedChatId && String(result.resolvedChatId) !== String(ch.channel_id)) {
      keyboard.push([
        {
          text: `💾 Save Numeric ID (${result.resolvedChatId})`,
          callback_data: `save_resolved_chid_${ch.id}_${result.resolvedChatId}`,
        },
      ]);
    }

    keyboard.push([
      { text: '✏ Edit Chat ID', callback_data: `edit_chid_${ch.id}` },
      { text: '🔄 Re-Test', callback_data: `test_ch_${ch.id}` },
    ]);
    keyboard.push([{ text: `⚙ Manage ${ch.name}`, callback_data: `manage_ch_${ch.id}` }]);
    keyboard.push([{ text: '🔙 Channels List', callback_data: 'cmd_channels' }]);

    return this.sendMessage(chatId, text, { inline_keyboard: keyboard });
  }

  public async sendRawChatDiagnosticReport(chatId: number | string, rawTarget: string): Promise<any> {
    await this.sendMessage(chatId, `🔍 Testing bot connectivity for <code>${rawTarget}</code>...`);

    const result = await this.testChannel(rawTarget);

    let text = `🔍 <b>DIAGNOSTIC REPORT</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📍 <b>Target Input:</b> <code>${result.target}</code>\n`;

    if (result.resolvedChatId) {
      text += `🆔 <b>Resolved Chat ID:</b> <code>${result.resolvedChatId}</code>\n`;
    }
    if (result.chatTitle) {
      text += `🏷 <b>Channel Title:</b> ${result.chatTitle}\n`;
    }

    if (result.success) {
      text += `\n✅ <b>STATUS: VERIFIED</b>\n• Administrator: ✅\n• Posting Allowed: ✅\n\n`;
    } else {
      text += `\n❌ <b>STATUS: FAILED</b>\n<b>Error:</b> ${result.message}\n`;
      if (result.details) {
        text += `\n💡 <b>Tip:</b>\n${result.details}\n`;
      }
    }

    const keyboard: any[] = [];
    const channels = db.getChannels();
    channels.forEach((ch) => {
      keyboard.push([
        {
          text: `📺 Set as ${ch.name}`,
          callback_data: `assign_forward_${ch.id}_${result.resolvedChatId || result.target}`,
        },
      ]);
    });
    keyboard.push([{ text: '🔙 Channels', callback_data: 'cmd_channels' }]);

    return this.sendMessage(chatId, text, { inline_keyboard: keyboard });
  }

  public async sendSettingsMenu(chatId: number | string): Promise<any> {
    const settings = db.getSettings();
    const tokenDisplay = settings.bot_token
      ? `${settings.bot_token.slice(0, 6)}...${settings.bot_token.slice(-4)}`
      : '<i>Not Configured</i>';

    const text =
      `⚙ <b>Bot Settings & Administration</b>\n\n` +
      `<b>Bot Token:</b> ${tokenDisplay}\n` +
      `<b>Polling Status:</b> ${settings.is_polling ? '🟢 Active' : '⚪ Idle'}\n` +
      `<b>Timezone:</b> ${settings.timezone} (IST)\n` +
      `<b>Authorized Owners:</b> ${settings.bot_owner_ids.join(', ')}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>Developer / Studio Credit:</b>\n` +
      `<i>${STUDIO_CREDIT}</i>`;

    return this.sendMessage(chatId, text, {
      inline_keyboard: [[{ text: '🔙 Main Menu', callback_data: 'cmd_main_menu' }]],
    });
  }

  // --- WEB SIMULATOR ACTION RUNNER ---
  public async simulateUserAction(action: {
    userId: string;
    text?: string;
    callback_data?: string;
    photo?: string;
  }): Promise<TelegramSimulationMessage[]> {
    const messages: TelegramSimulationMessage[] = [];
    const numId = parseInt(action.userId, 10) || 724118793;
    const fakeChatId = numId;

    // Temporary interception of sendMessage to capture messages for simulator
    const origSend = this.sendMessage.bind(this);
    const origPhoto = this.sendPhoto.bind(this);

    this.sendMessage = async (cId, txt, rMarkup) => {
      messages.push({
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        sender: 'bot',
        text: txt,
        reply_markup: rMarkup,
        timestamp: new Date().toISOString(),
      });
      return { message_id: Date.now() };
    };

    this.sendPhoto = async (cId, pUrl, cap, rMarkup) => {
      messages.push({
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        sender: 'bot',
        photo: pUrl,
        text: cap,
        reply_markup: rMarkup,
        timestamp: new Date().toISOString(),
      });
      return { message_id: Date.now() };
    };

    try {
      if (action.callback_data) {
        await this.handleCallbackQuery({
          id: `cq_${Date.now()}`,
          from: { id: numId },
          message: { chat: { id: fakeChatId }, message_id: Date.now() },
          data: action.callback_data,
        });
      } else {
        await this.handleIncomingMessage({
          chat: { id: fakeChatId },
          from: { id: numId },
          text: action.text,
          photo: action.photo ? [{ file_id: action.photo }] : undefined,
        });
      }
    } finally {
      this.sendMessage = origSend;
      this.sendPhoto = origPhoto;
    }

    return messages;
  }
}

export const telegramService = new TelegramService();

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db';
import { telegramService, normalizeTelegramChatId } from './server/telegram';
import { schedulerWorker } from './server/scheduler';
import { formatEpisodeButtonText, parseScheduleInput, STUDIO_CREDIT } from './src/utils/formatter';
import { PostType } from './src/types';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // Start background scheduler worker
  schedulerWorker.start();

  // Start Telegram bot worker (Supports Webhook if configured, or single active polling worker)
  telegramService.initBotService().catch((err) => {
    console.error('[Telegram Bot] Startup error:', err.message);
  });

  // --- HEALTH CHECKS ---
  app.get('/', (req, res, next) => {
    // If request accepts HTML (browser navigation), proceed to SPA static / vite handler
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
      return next();
    }
    // API / Ping / Bot health request
    res.status(200).json({
      status: 'ok',
      service: 'telegram-anime-cms',
    });
  });

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/api/health', (req, res) => {
    const settings = db.getSettings();
    res.status(200).json({
      status: 'ok',
      service: 'telegram-anime-cms',
      bot_mode: settings.webhook_url ? 'webhook' : 'polling',
      bot_polling: telegramService.isPollingActive(),
      webhook_url: settings.webhook_url || null,
      credit: STUDIO_CREDIT,
      timestamp: new Date().toISOString(),
    });
  });

  // --- TELEGRAM WEBHOOK ENDPOINT ---
  app.post('/telegram/webhook', async (req, res) => {
    try {
      const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
      const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

      if (expectedSecret && secretHeader !== expectedSecret) {
        return res.status(403).json({ error: 'Unauthorized webhook request' });
      }

      const update = req.body;
      if (update && typeof update === 'object') {
        // Asynchronously process update so Telegram receives immediate 200 OK
        telegramService.handleTelegramUpdate(update).catch((err) => {
          console.error('[Telegram Webhook] Update handling error:', err);
        });
      }
      res.status(200).json({ ok: true });
    } catch (err: any) {
      console.error('[Telegram Webhook] Error:', err);
      res.status(200).json({ ok: true }); // Always return 200 to Telegram to prevent retry storms
    }
  });

  // --- ANIMES API ---
  app.get('/api/animes', (req, res) => {
    const animes = db.getAnimes();
    const channels = db.getChannels();
    const result = animes.map((a) => ({
      ...a,
      channel_links: db.getChannelLinks(a.id),
    }));
    res.json({ animes: result, channels });
  });

  app.get('/api/animes/:id', (req, res) => {
    const anime = db.getAnime(req.params.id);
    if (!anime) return res.status(404).json({ error: 'Anime not found' });
    const channel_links = db.getChannelLinks(anime.id);
    res.json({ anime, channel_links });
  });

  app.post('/api/animes', (req, res) => {
    const { name, poster, caption, channel_links } = req.body;
    if (!name || !poster || !caption) {
      return res.status(400).json({ error: 'Anime Name, Poster, and Caption are required.' });
    }
    const anime = db.createAnime({ name, poster, caption });

    // If initial channel links are passed
    if (channel_links && typeof channel_links === 'object') {
      Object.entries(channel_links).forEach(([chId, url]) => {
        if (url && typeof url === 'string') {
          db.saveChannelLink(anime.id, chId, url);
        }
      });
    }

    res.status(201).json({ anime, channel_links: db.getChannelLinks(anime.id) });
  });

  app.put('/api/animes/:id', (req, res) => {
    const { name, poster, caption } = req.body;
    const updated = db.updateAnime(req.params.id, { name, poster, caption });
    if (!updated) return res.status(404).json({ error: 'Anime not found' });
    res.json({ anime: updated });
  });

  app.delete('/api/animes/:id', (req, res) => {
    const deleted = db.deleteAnime(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Anime not found' });
    res.json({ success: true, id: req.params.id });
  });

  // --- PERMANENT CHANNEL LINKS API ---
  app.get('/api/animes/:id/links', (req, res) => {
    const links = db.getChannelLinks(req.params.id);
    res.json({ links });
  });

  app.post('/api/animes/:id/links', (req, res) => {
    const { channelId, episodeUrl } = req.body;
    if (!channelId || !episodeUrl) {
      return res.status(400).json({ error: 'channelId and episodeUrl are required' });
    }
    const link = db.saveChannelLink(req.params.id, channelId, episodeUrl);
    res.json({ link, links: db.getChannelLinks(req.params.id) });
  });

  app.delete('/api/animes/:id/links/:channelId', (req, res) => {
    const ok = db.deleteChannelLink(req.params.id, req.params.channelId);
    res.json({ success: ok, links: db.getChannelLinks(req.params.id) });
  });

  // --- CHANNELS API ---
  app.get('/api/channels', (req, res) => {
    res.json({ channels: db.getChannels() });
  });

  app.post('/api/channels', (req, res) => {
    const { name, channel_id, buttons_row2 } = req.body;
    if (!name || !channel_id) {
      return res.status(400).json({ error: 'name and channel_id are required' });
    }
    const normalizedId = normalizeTelegramChatId(channel_id);
    const ch = db.createChannel({ name, channel_id: normalizedId, buttons_row2: buttons_row2 || [], is_enabled: true });
    res.status(201).json({ channel: ch });
  });

  app.put('/api/channels/:id', (req, res) => {
    const data = { ...req.body };
    if (data.channel_id) {
      data.channel_id = normalizeTelegramChatId(data.channel_id);
    }
    const updated = db.updateChannel(req.params.id, data);
    if (!updated) return res.status(404).json({ error: 'Channel not found' });
    res.json({ channel: updated });
  });

  app.delete('/api/channels/:id', (req, res) => {
    const ok = db.deleteChannel(req.params.id);
    if (!ok) return res.status(400).json({ error: 'Cannot delete channel or channel not found.' });
    res.json({ success: true });
  });

  app.post('/api/channels/:id/test', async (req, res) => {
    const ch = db.getChannel(req.params.id);
    if (!ch) return res.status(404).json({ error: 'Channel not found' });
    const check = await telegramService.testChannel(ch.channel_id);
    res.json(check);
  });

  app.post('/api/channels/test-target', async (req, res) => {
    const { target } = req.body;
    if (!target) return res.status(400).json({ error: 'target is required' });
    const check = await telegramService.testChannel(target);
    res.json(check);
  });

  // --- POST PREVIEW & PUBLISH API ---
  app.post('/api/posts/preview', (req, res) => {
    const { animeId, postType, episodeRange, customLinks } = req.body;
    const anime = db.getAnime(animeId);
    if (!anime) return res.status(404).json({ error: 'Anime not found' });

    const channels = db.getChannels().filter((c) => c.is_enabled);
    const buttonText = formatEpisodeButtonText(postType, episodeRange);

    const channelPreviews = channels.map((ch) => {
      const permanent = db.getChannelLink(anime.id, ch.id);
      const custom = customLinks?.[ch.id];
      const activeUrl = custom || permanent?.episode_url || '';
      return {
        channel: ch,
        activeUrl,
        isPermanent: !custom && !!permanent,
        hasLink: !!activeUrl,
        row1Button: { text: buttonText, url: activeUrl },
        row2Buttons: ch.buttons_row2,
      };
    });

    res.json({
      anime,
      postType,
      episodeRange,
      buttonText,
      channels: channelPreviews,
      canPublish: channelPreviews.every((cp) => cp.hasLink),
    });
  });

  app.post('/api/posts/publish', async (req, res) => {
    const { animeId, postType, episodeRange, customLinks } = req.body;
    try {
      const result = await telegramService.publishPostToChannels({
        animeId,
        postType: postType as PostType,
        episodeRange: episodeRange || (postType === 'movie' ? 'Full Movie' : '01'),
        customLinks,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Publishing error' });
    }
  });

  // --- SCHEDULES API ---
  app.get('/api/schedules', (req, res) => {
    res.json({ schedules: db.getScheduledPosts() });
  });

  app.post('/api/schedules', (req, res) => {
    const { animeId, postType, episodeRange, scheduleInput, customLinks } = req.body;
    const anime = db.getAnime(animeId);
    if (!anime) return res.status(404).json({ error: 'Anime not found' });

    try {
      const parsed = parseScheduleInput(scheduleInput);
      const sched = db.createScheduledPost({
        anime_id: animeId,
        anime_name: anime.name,
        post_type: postType,
        episode_range: episodeRange || (postType === 'movie' ? 'Full Movie' : '01'),
        custom_channel_links: customLinks || {},
        scheduled_time: parsed.date.toISOString(),
        scheduled_time_display: parsed.displayIST,
        created_by: 'Web CMS User',
      });
      res.status(201).json({ schedule: sched });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Invalid schedule time format' });
    }
  });

  app.put('/api/schedules/:id/reschedule', (req, res) => {
    const { scheduleInput } = req.body;
    if (!scheduleInput) {
      return res.status(400).json({ error: 'scheduleInput is required' });
    }

    try {
      const parsed = parseScheduleInput(scheduleInput);
      const updated = db.updateScheduledPost(req.params.id, {
        scheduled_time: parsed.date.toISOString(),
        scheduled_time_display: parsed.displayIST,
        state: 'PENDING',
        error_message: undefined,
      });

      if (!updated) return res.status(404).json({ error: 'Schedule not found' });
      res.json({ schedule: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Invalid schedule time format' });
    }
  });

  app.post('/api/schedules/:id/post-now', async (req, res) => {
    const sched = db.getScheduledPost(req.params.id);
    if (!sched) return res.status(404).json({ error: 'Schedule not found' });

    // Atomically claim schedule
    const claimed = db.atomicClaimSchedule(req.params.id);
    if (!claimed) {
      return res.status(409).json({ error: 'This schedule is already being processed or has already been posted.' });
    }

    try {
      const result = await telegramService.publishPostToChannels({
        animeId: sched.anime_id,
        postType: sched.post_type,
        episodeRange: sched.episode_range,
        customLinks: sched.custom_channel_links,
      });

      if (result.success) {
        db.completeSchedule(sched.id);
        res.json({ success: true, result, schedule: db.getScheduledPost(sched.id) });
      } else {
        db.failSchedule(sched.id, result.errors.join(', '));
        res.status(500).json({ success: false, errors: result.errors });
      }
    } catch (err: any) {
      db.failSchedule(sched.id, err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/schedules/:id', (req, res) => {
    const ok = db.deleteScheduledPost(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Schedule not found' });
    res.json({ success: true, id: req.params.id });
  });

  // --- HISTORY & SETTINGS & SIMULATOR ---
  app.get('/api/history', (req, res) => {
    res.json({ history: db.getPostingHistory() });
  });

  app.delete('/api/history', (req, res) => {
    db.clearPostingHistory();
    res.json({ success: true });
  });

  app.get('/api/settings', (req, res) => {
    res.json({ settings: db.getSettings() });
  });

  app.put('/api/settings', (req, res) => {
    const updated = db.updateSettings(req.body);
    res.json({ settings: updated });
  });

  app.post('/api/settings/toggle-polling', async (req, res) => {
    const settings = db.getSettings();
    if (settings.is_polling) {
      telegramService.stopPolling();
    } else {
      await telegramService.startPolling();
    }
    res.json({ settings: db.getSettings() });
  });

  app.post('/api/settings/webhook', async (req, res) => {
    const { url, secret } = req.body;
    try {
      if (!url) {
        await telegramService.deleteWebhook();
        await telegramService.startPolling();
        return res.json({ success: true, mode: 'polling', settings: db.getSettings() });
      }
      const tgRes = await telegramService.setWebhook(url, secret);
      const info = await telegramService.getWebhookInfo();
      res.json({ success: true, mode: 'webhook', tgRes, info, settings: db.getSettings() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/settings/webhook-info', async (req, res) => {
    try {
      const info = await telegramService.getWebhookInfo();
      res.json({ success: true, info });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/broadcast', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const channels = db.getChannels().filter((c) => c.is_enabled);
    let sent = 0;
    let failed = 0;

    for (const ch of channels) {
      try {
        await telegramService.sendMessage(ch.channel_id, message);
        sent++;
      } catch (err) {
        failed++;
      }
    }

    const log = db.addBroadcastLog(message, sent, failed);
    res.json({ success: true, log, sent, failed });
  });

  app.post('/api/simulate/telegram', async (req, res) => {
    const { userId, text, callback_data, photo } = req.body;
    try {
      const responseMessages = await telegramService.simulateUserAction({
        userId: userId || '724118793',
        text,
        callback_data,
        photo,
      });
      res.json({ messages: responseMessages });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- VITE MIDDLEWARE (DEV) & STATIC FALLBACK (PROD) ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CMS Server] Running on http://0.0.0.0:${PORT} (${STUDIO_CREDIT})`);
  });
}

startServer().catch((err) => {
  console.error('[Server Error] Failed to start:', err);
});

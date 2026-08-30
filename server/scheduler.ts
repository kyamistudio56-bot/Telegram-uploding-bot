import { db } from './db';
import { telegramService } from './telegram';

export class SchedulerWorker {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  public start() {
    if (this.timer) return;
    console.log('[Scheduler] Background Scheduler Worker initialized');
    // Check every 10 seconds
    this.timer = setInterval(() => this.tick(), 10000);
    // Initial immediate check
    this.tick();
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const now = new Date();
      const allSchedules = db.getScheduledPosts();
      
      // Filter schedules that are PENDING and due
      const dueSchedules = allSchedules.filter((s) => {
        if (s.state !== 'PENDING') return false;
        const schedTime = new Date(s.scheduled_time);
        return schedTime.getTime() <= now.getTime();
      });

      for (const item of dueSchedules) {
        // Atomic claim to prevent double trigger
        const claimed = db.atomicClaimSchedule(item.id);
        if (!claimed) continue;

        console.log(`[Scheduler] Processing scheduled post ${item.id} for "${item.anime_name}" (${item.episode_range})`);

        try {
          const result = await telegramService.publishPostToChannels({
            animeId: item.anime_id,
            postType: item.post_type,
            episodeRange: item.episode_range,
            customLinks: item.custom_channel_links,
          });

          if (result.success) {
            db.completeSchedule(item.id);
            console.log(`[Scheduler] Successfully executed scheduled post ${item.id}`);
          } else {
            db.failSchedule(item.id, result.errors.join('; '));
            console.error(`[Scheduler] Failed executing scheduled post ${item.id}:`, result.errors);
          }
        } catch (err: any) {
          db.failSchedule(item.id, err.message || 'Execution error');
          console.error(`[Scheduler] Exception executing scheduled post ${item.id}:`, err);
        }
      }
    } catch (err) {
      console.error('[Scheduler] Error in scheduler tick:', err);
    } finally {
      this.isRunning = false;
    }
  }
}

export const schedulerWorker = new SchedulerWorker();

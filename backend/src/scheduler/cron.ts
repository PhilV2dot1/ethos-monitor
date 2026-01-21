import cron from 'node-cron';
import { config_values } from '../config/env.js';
import logger from '../utils/logger.js';
import monitorService from '../services/monitor.service.js';

class Scheduler {
  private monitorJob: cron.ScheduledTask | null = null;
  private cleanupJob: cron.ScheduledTask | null = null;

  // Start all scheduled jobs
  start() {
    this.startMonitorJob();
    this.startCleanupJob();
    logger.info('Scheduler started');
  }

  // Monitor job - runs every N minutes
  private startMonitorJob() {
    const intervalMinutes = config_values.scheduler.intervalMinutes;
    const cronExpression = `*/${intervalMinutes} * * * *`;

    this.monitorJob = cron.schedule(cronExpression, async () => {
      logger.info('Scheduled monitor cycle starting...');
      try {
        const result = await monitorService.runMonitorCycle();
        logger.info(`Scheduled monitor completed: ${result.newNegative} negative, ${result.alertsSent} alerts`);
      } catch (error) {
        logger.error('Scheduled monitor cycle failed:', error);
      }
    });

    logger.info(`Monitor job scheduled: every ${intervalMinutes} minutes`);

    // Run immediately on startup
    setTimeout(async () => {
      logger.info('Initial monitor cycle starting...');
      try {
        await monitorService.runMonitorCycle();
      } catch (error) {
        logger.error('Initial monitor cycle failed:', error);
      }
    }, 5000); // Wait 5 seconds for services to initialize
  }

  // Cleanup job - runs daily at midnight
  private startCleanupJob() {
    this.cleanupJob = cron.schedule('0 0 * * *', async () => {
      logger.info('Daily cleanup starting...');
      try {
        // Add cleanup logic here if needed
        // e.g., delete old logs, archive old alerts, etc.
        logger.info('Daily cleanup completed');
      } catch (error) {
        logger.error('Daily cleanup failed:', error);
      }
    });

    logger.info('Cleanup job scheduled: daily at midnight');
  }

  // Stop all jobs
  stop() {
    if (this.monitorJob) {
      this.monitorJob.stop();
      this.monitorJob = null;
    }
    if (this.cleanupJob) {
      this.cleanupJob.stop();
      this.cleanupJob = null;
    }
    logger.info('Scheduler stopped');
  }

  // Manually trigger monitor
  async triggerMonitor() {
    return monitorService.runMonitorCycle();
  }

  // Get scheduler status
  getStatus() {
    return {
      monitorRunning: this.monitorJob !== null,
      cleanupRunning: this.cleanupJob !== null,
      ...monitorService.getStatus(),
    };
  }
}

export const scheduler = new Scheduler();
export default scheduler;

import cron from 'node-cron';
import { syncAllFixtures, processFinishedMatches } from '../services/syncService';
import { logger } from '../config/logger';

export function startSyncJobs(): void {
  // Every 5 minutes during tournament — sync and score
  cron.schedule('*/5 * * * *', async () => {
    try {
      await syncAllFixtures();
      await processFinishedMatches();
    } catch (error) {
      logger.error('Sync job failed:', error);
    }
  });

  // Daily at 6 AM UTC — full fixture sync
  cron.schedule('0 6 * * *', async () => {
    try {
      await syncAllFixtures();
    } catch (error) {
      logger.error('Daily sync failed:', error);
    }
  });

  logger.info('Sync jobs scheduled');
}

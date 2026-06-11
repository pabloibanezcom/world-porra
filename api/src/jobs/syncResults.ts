import cron from 'node-cron';
import { syncMatchResults, processFinishedMatches } from '../services/syncService';
import { syncOdds } from '../services/oddsService';
import { logger } from '../config/logger';
import { Match } from '../models/Match';
import { sendToAll } from '../services/pushService';
import { hydrateMatch } from '../services/countryTeamService';

export function startSyncJobs(): void {
  // Every 5 minutes during tournament — sync results and score
  cron.schedule('*/5 * * * *', async () => {
    try {
      await syncMatchResults({ daysBack: 1, daysForward: 1 });
      await processFinishedMatches();
    } catch (error) {
      logger.error({ err: error }, 'Sync job failed');
    }
  });

  // Daily at 6 AM UTC — refresh the full upcoming schedule and knockout bracket
  cron.schedule('0 6 * * *', async () => {
    try {
      await syncMatchResults({ daysBack: 1, daysForward: 40 });
    } catch (error) {
      logger.error({ err: error }, 'Daily sync failed');
    }
  });

  // Daily at 7 AM UTC — odds sync (1 API call covers all upcoming matches)
  cron.schedule('0 7 * * *', async () => {
    try {
      const result = await syncOdds();
      logger.info(result, 'Daily odds sync complete');
    } catch (error) {
      logger.error({ err: error }, 'Daily odds sync failed');
    }
  });

  // Every 5 min — kick-off reminder (30-min window)
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() + 25 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + 35 * 60 * 1000);
      const upcoming = await Match.find({
        utcDate: { $gte: windowStart, $lte: windowEnd },
        status: 'SCHEDULED',
      });
      for (const match of upcoming) {
        const localizedMatch = await hydrateMatch(match.toObject(), 'en');
        await sendToAll({
          title: 'Last chance to predict!',
          body: `${localizedMatch.homeTeam.name} vs ${localizedMatch.awayTeam.name} kicks off in ~30 minutes.`,
          url: '/matches',
        });
      }
    } catch (error) {
      logger.error({ err: error }, 'Kickoff reminder job failed');
    }
  });

  logger.info('Sync jobs scheduled');
}

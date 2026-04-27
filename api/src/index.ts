import { app } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { logger } from './config/logger';
import { startSyncJobs } from './jobs/syncResults';
import { backfillCountryCodes } from './services/countryTeamService';

async function start(): Promise<void> {
  await connectDB();
  await backfillCountryCodes();

  if (env.FOOTBALL_DATA_API_KEY) {
    startSyncJobs();
  } else {
    logger.info('No FOOTBALL_DATA_API_KEY — skipping sync jobs');

    if (env.USE_IN_MEMORY_DB || env.SEED_DEV_DATA) {
      const { seedDevMatches } = await import('./jobs/seedDev');
      await seedDevMatches();
    } else {
      logger.info('Skipping dev data seeding');
    }
  }

  app.listen(Number(env.PORT), () => {
    logger.info(`API server running on port ${env.PORT}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

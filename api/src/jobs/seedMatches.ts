import { connectDB } from '../config/db';
import { syncAllFixtures } from '../services/syncService';
import { logger } from '../config/logger';

async function seed(): Promise<void> {
  await connectDB();
  logger.info('Seeding matches from football-data.org...');
  await syncAllFixtures();
  logger.info('Seed complete');
  process.exit(0);
}

seed().catch((err) => {
  logger.error('Seed failed:', err);
  process.exit(1);
});

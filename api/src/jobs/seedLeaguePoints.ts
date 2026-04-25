import { connectDB } from '../config/db';
import { League } from '../models/League';
import { User } from '../models/User';
import { logger } from '../config/logger';

const MOCK_POINTS = [48, 35, 30, 22, 18, 12, 7, 4, 3, 2];

async function seedUserPoints() {
  await connectDB();

  // Collect all unique user IDs across all leagues
  const leagues = await League.find();
  const userIds = new Set<string>();
  for (const league of leagues) {
    for (const member of league.members) {
      userIds.add(member.userId.toString());
    }
  }

  if (!userIds.size) {
    logger.info('No league members found');
    process.exit(0);
  }

  const users = [...userIds];
  for (let i = 0; i < users.length; i++) {
    const pts = MOCK_POINTS[i] ?? Math.max(0, MOCK_POINTS[MOCK_POINTS.length - 1] - i * 2);
    await User.findByIdAndUpdate(users[i], { totalPoints: pts });
  }

  logger.info(`Updated totalPoints for ${users.length} users`);
  process.exit(0);
}

seedUserPoints().catch((err) => {
  logger.error(err);
  process.exit(1);
});

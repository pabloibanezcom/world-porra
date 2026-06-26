import { Types } from 'mongoose';
import { connectDB } from '../config/db';
import { League } from '../models/League';
import { GroupPrediction } from '../models/GroupPrediction';
import { Prediction } from '../models/Prediction';
import { User } from '../models/User';
import { logger } from '../config/logger';

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
  const userObjectIds = users.map((userId) => new Types.ObjectId(userId));
  const totals = await Prediction.aggregate<{ _id: unknown; total: number }>([
    { $match: { userId: { $in: userObjectIds }, points: { $ne: null } } },
    { $group: { _id: '$userId', total: { $sum: '$points' } } },
  ]);
  const groupTotals = await GroupPrediction.aggregate<{ _id: unknown; total: number }>([
    { $match: { userId: { $in: userObjectIds }, points: { $ne: null } } },
    { $group: { _id: '$userId', total: { $sum: '$points' } } },
  ]);
  const totalByUserId = new Map<string, number>();
  for (const { _id, total } of [...totals, ...groupTotals]) {
    const userId = String(_id);
    totalByUserId.set(userId, (totalByUserId.get(userId) ?? 0) + total);
  }

  await Promise.all(
    users.map((userId) => User.findByIdAndUpdate(userId, { totalPoints: totalByUserId.get(userId) ?? 0 }))
  );

  logger.info(`Recalculated totalPoints for ${users.length} users`);
  process.exit(0);
}

seedUserPoints().catch((err) => {
  logger.error(err);
  process.exit(1);
});

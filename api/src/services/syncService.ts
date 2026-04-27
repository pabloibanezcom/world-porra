import { Match } from '../models/Match';
import { Prediction } from '../models/Prediction';
import { User } from '../models/User';
import { fetchAllMatches, mapExternalMatch } from './footballApi';
import { calculatePoints } from './scoring';
import { logger } from '../config/logger';
import { MatchStage } from '../models/Match';
import { sendToUser } from './pushService';
import { hydrateMatch, upsertCountryTeamFromSource } from './countryTeamService';

export async function syncAllFixtures(): Promise<{ fixturesSynced: number }> {
  logger.info('Syncing all fixtures...');
  const externalMatches = await fetchAllMatches();

  for (const ext of externalMatches) {
    const mapped = mapExternalMatch(ext);
    await Promise.all([
      upsertCountryTeamFromSource(mapped.sourceTeams.home),
      upsertCountryTeamFromSource(mapped.sourceTeams.away),
    ]);

    const { sourceTeams, ...matchUpdate } = mapped;
    await Match.findOneAndUpdate({ externalId: mapped.externalId }, matchUpdate, { upsert: true });
  }

  logger.info(`Synced ${externalMatches.length} fixtures`);
  return { fixturesSynced: externalMatches.length };
}

export async function processFinishedMatches(): Promise<{
  matchesProcessed: number;
  predictionsScored: number;
  leaguesUpdated: number;
}> {
  const unprocessed = await Match.find({ status: 'FINISHED', scoresProcessed: false });
  let matchesProcessed = 0;
  let predictionsScored = 0;

  for (const match of unprocessed) {
    if (!match.result) continue;
    const localizedMatch = await hydrateMatch(match.toObject(), 'en');

    const predictions = await Prediction.find({ matchId: match._id });

    for (const prediction of predictions) {
      const points = calculatePoints({
        predictedHome: prediction.homeGoals,
        predictedAway: prediction.awayGoals,
        actualHome: match.result.homeGoals,
        actualAway: match.result.awayGoals,
        stage: match.stage as MatchStage,
      });

      prediction.points = points;
      await prediction.save();

      sendToUser(prediction.userId.toString(), {
        title: `${localizedMatch.homeTeam.name} ${match.result!.homeGoals}–${match.result!.awayGoals} ${localizedMatch.awayTeam.name}`,
        body: points > 0 ? `You earned ${points} point${points !== 1 ? 's' : ''}!` : 'No points this time — better luck next match.',
        url: '/picks',
      }).catch(() => {});
    }

    predictionsScored += predictions.length;
    matchesProcessed += 1;
    match.scoresProcessed = true;
    await match.save();

    logger.info(`Scored ${predictions.length} predictions for match ${localizedMatch.homeTeam.name} vs ${localizedMatch.awayTeam.name}`);
  }

  // Update total points on each user who had predictions scored
  const usersUpdated = await updateUserPoints();

  return { matchesProcessed, predictionsScored, leaguesUpdated: usersUpdated };
}

async function updateUserPoints(): Promise<number> {
  const results = await Prediction.aggregate([
    { $match: { points: { $ne: null } } },
    { $group: { _id: '$userId', total: { $sum: '$points' } } },
  ]);

  for (const { _id, total } of results) {
    await User.findByIdAndUpdate(_id, { totalPoints: total });
  }

  return results.length;
}

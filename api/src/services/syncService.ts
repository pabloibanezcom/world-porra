import { Match } from '../models/Match';
import { Prediction } from '../models/Prediction';
import { User } from '../models/User';
import { CountryTeam } from '../models/CountryTeam';
import { fetchAllMatches, mapExternalMatch } from './footballApi';
import { fetchWcMatches, FotmobMatch } from './fotmobApi';
import { calculatePoints } from './scoring';
import { logger } from '../config/logger';
import { MatchStage, MatchWinner } from '../models/Match';
import { sendToUser } from './pushService';
import { hydrateMatch, upsertCountryTeamFromSource } from './countryTeamService';
import { scoreCompletedGroupPredictions } from './predictionService';
import { GroupPrediction } from '../models/GroupPrediction';

// FotMob team names that differ from the English names we store.
const FOTMOB_NAME_ALIASES: Record<string, string> = {
  iran: 'IRN',
  'ir iran': 'IRN',
  turkey: 'TUR',
  turkiye: 'TUR',
  'korea republic': 'KOR',
  'south korea': 'KOR',
  'congo dr': 'COD',
  'dr congo': 'COD',
  'bosnia herzegovina': 'BIH',
  'bosnia and herzegovina': 'BIH',
  'ivory coast': 'CIV',
  'cote d ivoire': 'CIV',
  'cote divoire': 'CIV',
  'cote ivoire': 'CIV',
  curacao: 'CUW',
  curazao: 'CUW',
  'cape verde': 'CPV',
  'cabo verde': 'CPV',
  'czech republic': 'CZE',
  czechia: 'CZE',
  usa: 'USA',
  'united states': 'USA',
};

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Build a normalized English-name -> team code resolver from our own teams. */
async function buildTeamCodeResolver(): Promise<(name: string) => string | null> {
  const teams = await CountryTeam.find({}).select('code names').lean();
  const byName = new Map<string, string>();
  for (const team of teams) {
    const names = team.names as unknown as Record<string, string> | Map<string, string>;
    const englishName = names instanceof Map ? names.get('en') : names?.en;
    if (englishName) byName.set(normalizeTeamName(englishName), team.code);
  }
  return (name: string) => {
    if (!name) return null;
    const key = normalizeTeamName(name);
    return FOTMOB_NAME_ALIASES[key] ?? byName.get(key) ?? null;
  };
}

function resolveWinner(fm: FotmobMatch): MatchWinner {
  const home = fm.homeScore ?? 0;
  const away = fm.awayScore ?? 0;
  if (home > away) return 'HOME';
  if (away > home) return 'AWAY';
  // Knockout tie decided on penalties — FotMob marks the eliminated team.
  if (fm.eliminatedTeamId != null) {
    if (fm.eliminatedTeamId === fm.homeId) return 'AWAY';
    if (fm.eliminatedTeamId === fm.awayId) return 'HOME';
  }
  return 'DRAW';
}

/** Locate the stored match a FotMob fixture corresponds to. */
async function locateMatch(fm: FotmobMatch, resolveCode: (name: string) => string | null) {
  if (typeof fm.fotmobId === 'number') {
    const byId = await Match.findOne({ fotmobMatchId: fm.fotmobId });
    if (byId) return byId;
  }

  const homeCode = resolveCode(fm.homeName);
  const awayCode = resolveCode(fm.awayName);

  if (fm.utcTime) {
    const atTime = await Match.find({ utcDate: fm.utcTime });
    if (atTime.length === 1) return atTime[0];
    if (atTime.length > 1 && homeCode && awayCode) {
      const match = atTime.find((m) => m.homeTeamCode === homeCode && m.awayTeamCode === awayCode);
      if (match) return match;
    }
  }

  // Fallback by team pairing (handles reschedules; a group pairing is unique).
  if (homeCode && awayCode) {
    return Match.findOne({ homeTeamCode: homeCode, awayTeamCode: awayCode });
  }
  return null;
}

export interface SyncMatchResultsOptions {
  daysBack?: number;
  daysForward?: number;
}

export const LIVE_RESULTS_DAYS_BACK = 1;
export const BRACKET_FIXTURE_DAYS_FORWARD = 7;
export const FULL_FIXTURE_DAYS_FORWARD = 40;

/**
 * Pull World Cup match data from FotMob and update our stored matches: live and
 * finished scores, knockout bracket teams as they're decided, and reschedules.
 * Admin-entered results (`manualResult`) are never overwritten. Scoring of
 * finished matches is handled separately by processFinishedMatches.
 */
export async function syncMatchResults(
  options: SyncMatchResultsOptions = {}
): Promise<{ matchesUpdated: number; matchesUnmatched: number }> {
  const { daysBack = LIVE_RESULTS_DAYS_BACK, daysForward = BRACKET_FIXTURE_DAYS_FORWARD } = options;
  logger.info({ daysBack, daysForward }, 'Syncing match results from FotMob...');

  const fmMatches = await fetchWcMatches(daysBack, daysForward);
  const resolveCode = await buildTeamCodeResolver();

  let matchesUpdated = 0;
  let matchesUnmatched = 0;

  for (const fm of fmMatches) {
    const match = await locateMatch(fm, resolveCode);
    if (!match) {
      matchesUnmatched += 1;
      logger.warn(
        { fotmobId: fm.fotmobId, home: fm.homeName, away: fm.awayName, utc: fm.utcTime },
        'FotMob match could not be mapped to a stored match'
      );
      continue;
    }

    const updates: Record<string, unknown> = {};

    if (match.fotmobMatchId !== fm.fotmobId) {
      updates.fotmobMatchId = fm.fotmobId;
    }

    // Fill knockout bracket teams once FotMob reveals them.
    const homeCode = resolveCode(fm.homeName);
    const awayCode = resolveCode(fm.awayName);
    if (homeCode && match.homeTeamCode === 'TBD') {
      updates.homeTeamCode = homeCode;
    }
    if (awayCode && match.awayTeamCode === 'TBD') {
      updates.awayTeamCode = awayCode;
    }

    // Keep kickoff time in sync (reschedules).
    if (fm.utcTime && match.utcDate.getTime() !== fm.utcTime.getTime()) {
      updates.utcDate = fm.utcTime;
    }

    // Never touch status/result of an admin-entered result.
    if (!match.manualResult) {
      const hasScore = fm.homeScore != null && fm.awayScore != null;
      if (fm.cancelled) {
        if (match.status !== 'POSTPONED') {
          updates.status = 'POSTPONED';
        }
      } else if (fm.finished && hasScore) {
        const winner = resolveWinner(fm);
        if (
          match.status !== 'FINISHED' ||
          match.result?.homeGoals !== fm.homeScore ||
          match.result?.awayGoals !== fm.awayScore ||
          match.result?.winner !== winner
        ) {
          updates.status = 'FINISHED';
          updates.result = { homeGoals: fm.homeScore!, awayGoals: fm.awayScore!, winner };
          updates.scoresProcessed = false;
        }
      } else if (fm.started && hasScore) {
        const winner = resolveWinner(fm);
        updates.status = 'LIVE';
        updates.result = { homeGoals: fm.homeScore!, awayGoals: fm.awayScore!, winner };
      }
    }

    if (Object.keys(updates).length > 0) {
      await Match.updateOne({ _id: match._id }, { $set: updates }, { runValidators: false });
      matchesUpdated += 1;
    }
  }

  logger.info({ matchesUpdated, matchesUnmatched, fetched: fmMatches.length }, 'FotMob match sync complete');
  return { matchesUpdated, matchesUnmatched };
}

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

    // Preserve admin-entered results: football-data frequently reports a match
    // as FINISHED with a null score, which would otherwise wipe a manual result
    // and revert the status. For those matches, refresh only descriptive fields.
    const existing = await Match.findOne({ externalId: mapped.externalId })
      .select('manualResult')
      .lean();

    if (existing?.manualResult) {
      const { status: _status, result: _result, ...descriptiveFields } = matchUpdate;
      await Match.updateOne({ externalId: mapped.externalId }, descriptiveFields);
    } else {
      await Match.findOneAndUpdate({ externalId: mapped.externalId }, matchUpdate, { upsert: true });
    }
  }

  logger.info(`Synced ${externalMatches.length} fixtures`);
  return { fixturesSynced: externalMatches.length };
}

export async function processFinishedMatches(): Promise<{
  matchesProcessed: number;
  predictionsScored: number;
  groupPredictionsScored: number;
  leaguesUpdated: number;
}> {
  const unprocessed = await Match.find({ status: 'FINISHED', scoresProcessed: false });
  let matchesProcessed = 0;
  let predictionsScored = 0;
  const processedGroups = new Set<string>();

  for (const match of unprocessed) {
    if (!match.result) continue;
    const localizedMatch = await hydrateMatch(match.toObject(), 'en');

    const predictions = await Prediction.find({ matchId: match._id });

    for (const prediction of predictions) {
      const rawPoints = calculatePoints({
        predictedHome: prediction.homeGoals,
        predictedAway: prediction.awayGoals,
        actualHome: match.result.homeGoals,
        actualAway: match.result.awayGoals,
        stage: match.stage as MatchStage,
        odds: match.odds,
        qualifier: prediction.qualifier,
        actualWinner: match.result.winner,
      });

      // Joker doubles the total points earned on the selected match.
      const points = prediction.joker ? rawPoints * 2 : rawPoints;
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
    await Match.updateOne({ _id: match._id }, { $set: { scoresProcessed: true } }, { runValidators: false });
    if (match.stage === 'GROUP' && match.group) processedGroups.add(match.group);

    logger.info(`Scored ${predictions.length} predictions for match ${localizedMatch.homeTeam.name} vs ${localizedMatch.awayTeam.name}`);
  }

  const groupPredictionResult = await scoreCompletedGroupPredictions([...processedGroups]);
  const groupPredictionsScored = groupPredictionResult.predictionsScored;

  // Update total points on each user who had predictions scored
  const usersUpdated = await recalculateUserPoints();

  return { matchesProcessed, predictionsScored, groupPredictionsScored, leaguesUpdated: usersUpdated };
}

export async function recalculateUserPoints(): Promise<number> {
  const predictionTotals = await Prediction.aggregate([
    { $match: { points: { $ne: null } } },
    { $group: { _id: '$userId', total: { $sum: '$points' } } },
  ]);
  const groupPredictionTotals = await GroupPrediction.aggregate([
    { $match: { points: { $ne: null } } },
    { $group: { _id: '$userId', total: { $sum: '$points' } } },
  ]);

  const totalsByUserId = new Map<string, number>();
  for (const { _id, total } of [...predictionTotals, ...groupPredictionTotals]) {
    const userId = String(_id);
    totalsByUserId.set(userId, (totalsByUserId.get(userId) ?? 0) + total);
  }

  for (const [userId, total] of totalsByUserId) {
    const _id = userId;
    await User.findByIdAndUpdate(_id, { totalPoints: total });
  }

  return totalsByUserId.size;
}

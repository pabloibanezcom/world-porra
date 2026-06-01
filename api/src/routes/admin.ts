import { NextFunction, Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { syncAuthMiddleware } from '../middleware/syncAuth';
import { GroupPrediction } from '../models/GroupPrediction';
import { League } from '../models/League';
import { Prediction } from '../models/Prediction';
import { TournamentPrediction } from '../models/TournamentPrediction';
import { User } from '../models/User';
import { processFinishedMatches, syncAllFixtures } from '../services/syncService';
import { syncOdds } from '../services/oddsService';
import { seedTournamentScenarios } from '../jobs/seedScenario';
import { SCENARIOS, getDbName, getScenarioDbName, scenarioBySlug } from '../jobs/tournamentScenarios';

const router = Router();

const syncSchema = z.object({
  syncFixtures: z.boolean().default(true),
  processResults: z.boolean().default(true),
  syncOdds: z.boolean().default(false),
  forceOdds: z.boolean().default(false),
});

const seedScenariosSchema = z.object({
  scenarios: z.union([z.literal('all'), z.array(z.string().min(1)).min(1)]).default('all'),
});

const listUsersSchema = z.object({
  search: z.string().trim().max(100).optional(),
});

function redactSensitiveError(value: string): string {
  const withoutMongoCredentials = value.replace(/mongodb(?:\+srv)?:\/\/[^@\s]+@/gu, 'mongodb://<redacted>@');
  return env.SYNC_API_KEY ? withoutMongoCredentials.replace(new RegExp(env.SYNC_API_KEY, 'gu'), '<redacted>') : withoutMongoCredentials;
}

async function requireMasterUser(req: AuthRequest, res: Response): Promise<boolean> {
  if (!req.userId) {
    res.status(401).json({ error: 'Missing authenticated user' });
    return false;
  }

  const user = await User.findById(req.userId).select('isMaster').lean();
  if (!user?.isMaster) {
    res.status(403).json({ error: 'Only master users can access admin users' });
    return false;
  }

  return true;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function serializeAdminUser(user: any, leagues: any[], counts: {
  predictions: number;
  groupPredictions: number;
  hasTournamentPrediction: boolean;
}) {
  return {
    id: String(user._id),
    _id: String(user._id),
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl ?? '',
    totalPoints: user.totalPoints ?? 0,
    isMaster: !!user.isMaster,
    canCreateLeagues: !!user.canCreateLeagues,
    createdAt: new Date(user.createdAt).toISOString(),
    updatedAt: new Date(user.updatedAt).toISOString(),
    leagueCount: leagues.length,
    predictionCount: counts.predictions,
    groupPredictionCount: counts.groupPredictions,
    hasTournamentPrediction: counts.hasTournamentPrediction,
    leagues: leagues.map((league) => {
      const member = league.members.find((entry: any) => entry.userId?.toString() === user._id.toString());
      return {
        _id: String(league._id),
        name: league.name,
        inviteCode: league.inviteCode,
        joinedAt: new Date(member?.joinedAt ?? league.createdAt).toISOString(),
        isAdmin: !!member?.isAdmin || league.ownerId?.toString() === user._id.toString(),
        hasPaid: !!member?.hasPaid,
      };
    }),
  };
}

async function buildAdminUserSummary(user: any) {
  const userId = user._id;
  const [leagues, predictionCount, groupPredictionCount, tournamentPrediction] = await Promise.all([
    League.find({ 'members.userId': userId }).select('name inviteCode ownerId members createdAt').lean(),
    Prediction.countDocuments({ userId }),
    GroupPrediction.countDocuments({ userId }),
    TournamentPrediction.exists({ userId }),
  ]);

  return serializeAdminUser(user, leagues, {
    predictions: predictionCount,
    groupPredictions: groupPredictionCount,
    hasTournamentPrediction: !!tournamentPrediction,
  });
}

router.get('/users', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await requireMasterUser(req, res))) return;

    const { search } = listUsersSchema.parse(req.query);
    const query = search
      ? {
          $or: [
            { email: new RegExp(escapeRegex(search), 'i') },
            { name: new RegExp(escapeRegex(search), 'i') },
          ],
        }
      : {};

    const users = await User.find(query).select('-passwordHash -__v').sort({ createdAt: -1 }).limit(200).lean();
    const summaries = await Promise.all(users.map(buildAdminUserSummary));
    const total = await User.countDocuments(query);

    res.json({ users: summaries, total });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid user search', details: error.errors });
      return;
    }
    next(error);
  }
});

router.get('/users/:userId', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await requireMasterUser(req, res))) return;

    const user = await User.findById(req.params.userId).select('-passwordHash -__v').lean();
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const [summary, predictionTotal, predictionScored, recentPredictions, groupPredictions, tournamentPrediction] = await Promise.all([
      buildAdminUserSummary(user),
      Prediction.countDocuments({ userId: user._id }),
      Prediction.countDocuments({ userId: user._id, points: { $ne: null } }),
      Prediction.find({ userId: user._id })
        .sort({ updatedAt: -1 })
        .limit(30)
        .populate('matchId', '+homeTeam +awayTeam stage group utcDate result homeTeamCode awayTeamCode')
        .lean(),
      GroupPrediction.find({ userId: user._id }).sort({ group: 1 }).lean(),
      TournamentPrediction.findOne({ userId: user._id }).lean(),
    ]);

    res.json({
      user: summary,
      predictions: {
        total: predictionTotal,
        scored: predictionScored,
        pending: predictionTotal - predictionScored,
        recent: recentPredictions.map((prediction: any) => {
          const match = prediction.matchId;
          return {
            _id: String(prediction._id),
            matchId: match?._id ? String(match._id) : String(prediction.matchId),
            homeGoals: prediction.homeGoals,
            awayGoals: prediction.awayGoals,
            qualifier: prediction.qualifier ?? null,
            points: prediction.points ?? null,
            createdAt: new Date(prediction.createdAt).toISOString(),
            updatedAt: new Date(prediction.updatedAt).toISOString(),
            match: match?._id
              ? {
                  _id: String(match._id),
                  stage: match.stage,
                  group: match.group ?? null,
                  utcDate: new Date(match.utcDate).toISOString(),
                  homeTeam: match.homeTeam ?? { code: match.homeTeamCode, name: match.homeTeamCode, crest: '' },
                  awayTeam: match.awayTeam ?? { code: match.awayTeamCode, name: match.awayTeamCode, crest: '' },
                  result: match.result ?? null,
                }
              : null,
          };
        }),
      },
      groupPredictions: groupPredictions.map((prediction) => ({
        _id: String(prediction._id),
        group: prediction.group,
        orderedTeamCodes: prediction.orderedTeamCodes,
        points: prediction.points ?? null,
        createdAt: new Date(prediction.createdAt).toISOString(),
        updatedAt: new Date(prediction.updatedAt).toISOString(),
      })),
      tournamentPrediction: tournamentPrediction
        ? {
            championCode: tournamentPrediction.championCode,
            runnerUpCode: tournamentPrediction.runnerUpCode,
            semi1Code: tournamentPrediction.semi1Code,
            semi2Code: tournamentPrediction.semi2Code,
            bestPlayer: tournamentPrediction.bestPlayer,
            topScorer: tournamentPrediction.topScorer,
            bestYoung: tournamentPrediction.bestYoung,
            createdAt: new Date(tournamentPrediction.createdAt).toISOString(),
            updatedAt: new Date(tournamentPrediction.updatedAt).toISOString(),
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/sync', syncAuthMiddleware, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { syncFixtures, processResults, syncOdds: doSyncOdds, forceOdds } = syncSchema.parse(req.body ?? {});

    if (!syncFixtures && !processResults && !doSyncOdds) {
      res.status(400).json({ error: 'At least one sync action must be enabled' });
      return;
    }

    if (syncFixtures && !env.FOOTBALL_DATA_API_KEY) {
      res.status(503).json({ error: 'FOOTBALL_DATA_API_KEY is not configured on the server' });
      return;
    }

    if (doSyncOdds && !env.ODDS_API_KEY) {
      res.status(503).json({ error: 'ODDS_API_KEY is not configured on the server' });
      return;
    }

    logger.info({ syncFixtures, processResults, syncOdds: doSyncOdds, forceOdds }, 'Running manual sync');

    const fixtureResult = syncFixtures ? await syncAllFixtures() : { fixturesSynced: 0 };
    const scoringResult = processResults
      ? await processFinishedMatches()
      : { matchesProcessed: 0, predictionsScored: 0, leaguesUpdated: 0 };
    const oddsResult = doSyncOdds ? await syncOdds({ force: forceOdds }) : { matchesUpdated: 0, requestsRemaining: null };

    res.json({
      ok: true,
      syncFixtures,
      processResults,
      syncOdds: doSyncOdds,
      forceOdds,
      ...fixtureResult,
      ...scoringResult,
      oddsMatchesUpdated: oddsResult.matchesUpdated,
      oddsRequestsRemaining: oddsResult.requestsRemaining,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid sync payload', details: error.errors });
      return;
    }

    next(error);
  }
});

router.post('/scenarios/seed', syncAuthMiddleware, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { scenarios } = seedScenariosSchema.parse(req.body ?? {});
    const slugs = scenarios === 'all' ? ['all'] : scenarios;

    logger.info({ scenarios: slugs }, 'Seeding tournament scenario databases');

    const results = await seedTournamentScenarios({ slugs });

    res.json({
      ok: true,
      scenarios: results.map(({ mongodbUri, ...result }) => result),
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid scenario seed payload', details: error.errors });
      return;
    }

    const message = error instanceof Error ? redactSensitiveError(error.message) : 'Unknown scenario seed error';
    logger.error({ err: error }, 'Scenario database seed failed');
    res.status(500).json({ error: 'Scenario database seed failed', message });
  }
});

router.post('/scenarios/status', syncAuthMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { scenarios } = seedScenariosSchema.parse(req.body ?? {});
    const selectedScenarios = scenarios === 'all'
      ? SCENARIOS
      : scenarios.map((slug) => {
          const scenario = scenarioBySlug(slug);
          if (!scenario) throw new Error(`Unknown scenario "${slug}"`);
          return scenario;
        });
    const client = mongoose.connection.getClient();
    const baseDbName = getDbName(env.SCENARIO_BASE_MONGODB_URI || env.MONGODB_URI);

    const statuses = await Promise.all(selectedScenarios.map(async (scenario) => {
      const dbName = getScenarioDbName(baseDbName, scenario);
      const db = client.db(dbName);
      const [matches, users, leagues, predictions, scoredPredictions] = await Promise.all([
        db.collection('matches').countDocuments(),
        db.collection('users').countDocuments(),
        db.collection('leagues').countDocuments(),
        db.collection('predictions').countDocuments(),
        db.collection('predictions').countDocuments({ points: { $ne: null } }),
      ]);

      return {
        slug: scenario.slug,
        dbName,
        matches,
        users,
        leagues,
        predictions,
        scoredPredictions,
      };
    }));

    res.json({ ok: true, scenarios: statuses, ranAt: new Date().toISOString() });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid scenario status payload', details: error.errors });
      return;
    }

    const message = error instanceof Error ? redactSensitiveError(error.message) : 'Unknown scenario status error';
    logger.error({ err: error }, 'Scenario database status failed');
    res.status(500).json({ error: 'Scenario database status failed', message });
  }
});

export default router;

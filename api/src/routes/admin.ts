import { NextFunction, Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { syncAuthMiddleware } from '../middleware/syncAuth';
import { GroupPrediction } from '../models/GroupPrediction';
import { League } from '../models/League';
import { ContactMessage } from '../models/ContactMessage';
import { LeagueCreationInvite } from '../models/LeagueCreationInvite';
import { LeagueReminderLog } from '../models/LeagueReminderLog';
import { Match } from '../models/Match';
import { Prediction } from '../models/Prediction';
import { PushSubscription } from '../models/PushSubscription';
import { TournamentPrediction } from '../models/TournamentPrediction';
import { User } from '../models/User';
import { UserDevice } from '../models/UserDevice';
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

const deleteUserSchema = z.object({
  confirmation: z.string().trim().min(1),
});

const TOURNAMENT_PICK_FIELDS = ['championCode', 'runnerUpCode', 'semi1Code', 'semi2Code', 'bestPlayer', 'topScorer', 'bestYoung'] as const;

interface AdminUserCompletionTotals {
  matchTotal: number;
  groupTotal: number;
  tournamentTotal: number;
}

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
  tournamentPrediction: any;
  deviceSummary: {
    kind: 'pwa' | 'web' | 'unknown' | 'none';
    platform: 'web' | 'ios' | 'android' | 'unknown' | null;
    lastSeenAt: string | null;
  };
  totals: AdminUserCompletionTotals;
}) {
  const tournamentMade = counts.tournamentPrediction
    ? TOURNAMENT_PICK_FIELDS.filter((field) => !!counts.tournamentPrediction[field]).length
    : 0;

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
    hasTournamentPrediction: !!counts.tournamentPrediction,
    device: counts.deviceSummary,
    predictionCompletion: {
      matchesMade: counts.predictions,
      matchesTotal: counts.totals.matchTotal,
      groupsMade: counts.groupPredictions,
      groupsTotal: counts.totals.groupTotal,
      tournamentMade,
      tournamentTotal: counts.totals.tournamentTotal,
      complete:
        counts.predictions >= counts.totals.matchTotal &&
        counts.groupPredictions >= counts.totals.groupTotal &&
        tournamentMade >= counts.totals.tournamentTotal,
    },
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

async function getAdminUserCompletionTotals(): Promise<AdminUserCompletionTotals> {
  const [matchTotal, groups] = await Promise.all([
    Match.countDocuments({
      status: { $ne: 'POSTPONED' },
      homeTeamCode: { $nin: ['TBD', ''] },
      awayTeamCode: { $nin: ['TBD', ''] },
    }),
    Match.distinct('group', {
      stage: 'GROUP',
      group: { $ne: null },
      homeTeamCode: { $nin: ['TBD', ''] },
      awayTeamCode: { $nin: ['TBD', ''] },
    }),
  ]);

  return {
    matchTotal,
    groupTotal: groups.filter(Boolean).length,
    tournamentTotal: TOURNAMENT_PICK_FIELDS.length,
  };
}

async function buildAdminUserSummary(user: any, totals?: AdminUserCompletionTotals) {
  const userId = user._id;
  const resolvedTotals = totals ?? await getAdminUserCompletionTotals();
  const [leagues, predictionCount, groupPredictionCount, tournamentPrediction, latestDevice, standaloneDevice] = await Promise.all([
    League.find({ 'members.userId': userId }).select('name inviteCode ownerId members createdAt').lean(),
    Prediction.countDocuments({ userId }),
    GroupPrediction.countDocuments({ userId }),
    TournamentPrediction.findOne({ userId }).select(TOURNAMENT_PICK_FIELDS.join(' ')).lean(),
    UserDevice.findOne({ userId }).sort({ lastSeenAt: -1 }).lean(),
    UserDevice.findOne({ userId, displayMode: 'standalone' }).sort({ lastSeenAt: -1 }).lean(),
  ]);
  const device = standaloneDevice ?? latestDevice;
  const deviceKind = standaloneDevice
    ? 'pwa'
    : latestDevice?.displayMode === 'browser'
      ? 'web'
      : latestDevice
        ? 'unknown'
        : 'none';

  return serializeAdminUser(user, leagues, {
    predictions: predictionCount,
    groupPredictions: groupPredictionCount,
    tournamentPrediction,
    deviceSummary: {
      kind: deviceKind,
      platform: device?.platform ?? null,
      lastSeenAt: device?.lastSeenAt ? new Date(device.lastSeenAt).toISOString() : null,
    },
    totals: resolvedTotals,
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

    const [users, totals] = await Promise.all([
      User.find(query).select('-passwordHash -__v').sort({ createdAt: -1 }).limit(200).lean(),
      getAdminUserCompletionTotals(),
    ]);
    const summaries = await Promise.all(users.map((user) => buildAdminUserSummary(user, totals)));
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

    const [summary, predictionTotal, predictionScored, recentPredictions, groupPredictions, tournamentPrediction, groupStageCounts, devices] = await Promise.all([
      buildAdminUserSummary(user),
      Prediction.countDocuments({ userId: user._id }),
      Prediction.countDocuments({ userId: user._id, points: { $ne: null } }),
      Prediction.find({ userId: user._id })
        .select('matchId homeGoals awayGoals qualifier points createdAt updatedAt')
        .sort({ updatedAt: -1 })
        .limit(30)
        .populate('matchId', '+homeTeam +awayTeam stage status group utcDate homeTeamCode awayTeamCode')
        .lean(),
      GroupPrediction.find({ userId: user._id }).sort({ group: 1 }).lean(),
      TournamentPrediction.findOne({ userId: user._id }).select('createdAt updatedAt').lean(),
      Promise.all([
        Match.countDocuments({ stage: 'GROUP' }),
        Match.countDocuments({ stage: 'GROUP', status: { $ne: 'FINISHED' } }),
      ]),
      UserDevice.find({ userId: user._id }).sort({ lastSeenAt: -1 }).limit(20).lean(),
    ]);
    const groupStageComplete = groupStageCounts[0] > 0 && groupStageCounts[1] === 0;

    res.json({
      user: summary,
      predictions: {
        total: predictionTotal,
        scored: predictionScored,
        pending: predictionTotal - predictionScored,
        recent: recentPredictions.map((prediction: any) => {
          const match = prediction.matchId;
          const isRevealed = match?.status === 'FINISHED';
          return {
            _id: String(prediction._id),
            matchId: match?._id ? String(match._id) : String(prediction.matchId),
            hasPrediction: true,
            isRevealed,
            ...(isRevealed
              ? {
                  homeGoals: prediction.homeGoals,
                  awayGoals: prediction.awayGoals,
                  qualifier: prediction.qualifier ?? null,
                  points: prediction.points ?? null,
                }
              : {}),
            createdAt: new Date(prediction.createdAt).toISOString(),
            updatedAt: new Date(prediction.updatedAt).toISOString(),
            match: match?._id
              ? {
                  _id: String(match._id),
                  stage: match.stage,
                  status: match.status,
                  group: match.group ?? null,
                  utcDate: new Date(match.utcDate).toISOString(),
                  homeTeam: match.homeTeam ?? { code: match.homeTeamCode, name: match.homeTeamCode, crest: '' },
                  awayTeam: match.awayTeam ?? { code: match.awayTeamCode, name: match.awayTeamCode, crest: '' },
                }
              : null,
          };
        }),
      },
      groupPredictions: groupPredictions.map((prediction) => ({
        _id: String(prediction._id),
        group: prediction.group,
        hasPrediction: true,
        isRevealed: groupStageComplete,
        ...(groupStageComplete
          ? {
              orderedTeamCodes: prediction.orderedTeamCodes,
              points: prediction.points ?? null,
            }
          : {}),
        createdAt: new Date(prediction.createdAt).toISOString(),
        updatedAt: new Date(prediction.updatedAt).toISOString(),
      })),
      tournamentPrediction: tournamentPrediction
        ? {
            hasPrediction: true,
            createdAt: new Date(tournamentPrediction.createdAt).toISOString(),
            updatedAt: new Date(tournamentPrediction.updatedAt).toISOString(),
          }
        : null,
      devices: devices.map((device) => ({
        _id: String(device._id),
        deviceId: device.deviceId,
        displayMode: device.displayMode,
        platform: device.platform,
        userAgent: device.userAgent,
        browserLanguage: device.browserLanguage,
        firstSeenAt: new Date(device.firstSeenAt).toISOString(),
        lastSeenAt: new Date(device.lastSeenAt).toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/users/:userId', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await requireMasterUser(req, res))) return;

    const userId = req.params.userId;
    if (typeof userId !== 'string') {
      res.status(400).json({ error: 'Invalid user id' });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ error: 'Invalid user id' });
      return;
    }

    if (userId === req.userId) {
      res.status(400).json({ error: 'You cannot delete your own account' });
      return;
    }

    const { confirmation } = deleteUserSchema.parse(req.body ?? {});
    const user = await User.findById(userId).select('email isMaster').lean();
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (confirmation !== user.email) {
      res.status(400).json({ error: "Type the user's email to confirm deletion" });
      return;
    }

    if (user.isMaster) {
      const masterCount = await User.countDocuments({ isMaster: true });
      if (masterCount <= 1) {
        res.status(400).json({ error: 'Cannot delete the last master user' });
        return;
      }
    }

    const targetUserId = new mongoose.Types.ObjectId(userId);
    const ownedLeagues = await League.find({ ownerId: targetUserId }).select('_id').lean();
    const ownedLeagueIds = ownedLeagues.map((league) => league._id);

    const [
      predictions,
      groupPredictions,
      tournamentPredictions,
      devices,
      pushSubscriptions,
      contactMessages,
      leagueCreationInvites,
    ] = await Promise.all([
      Prediction.deleteMany({ userId: targetUserId }),
      GroupPrediction.deleteMany({ userId: targetUserId }),
      TournamentPrediction.deleteMany({ userId: targetUserId }),
      UserDevice.deleteMany({ userId: targetUserId }),
      PushSubscription.deleteMany({ userId: targetUserId }),
      ContactMessage.deleteMany({ userId: targetUserId }),
      LeagueCreationInvite.deleteMany({ $or: [{ createdBy: targetUserId }, { usedBy: targetUserId }] }),
    ]);

    if (ownedLeagueIds.length > 0) {
      await League.deleteMany({ _id: { $in: ownedLeagueIds } });
      await LeagueReminderLog.deleteMany({ leagueId: { $in: ownedLeagueIds } });
    }

    await Promise.all([
      League.updateMany(
        { _id: { $nin: ownedLeagueIds }, 'members.userId': targetUserId },
        { $pull: { members: { userId: targetUserId } } }
      ),
      ContactMessage.updateMany({ 'replies.senderId': targetUserId }, { $pull: { replies: { senderId: targetUserId } } }),
      User.updateMany({ leagueOrder: { $in: ownedLeagueIds } }, { $pull: { leagueOrder: { $in: ownedLeagueIds } } }),
    ]);

    const deletedUser = await User.deleteOne({ _id: targetUserId });
    if (deletedUser.deletedCount === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    logger.info(
      {
        adminUserId: req.userId,
        deletedUserId: userId,
        deletedUserEmail: user.email,
        ownedLeagueCount: ownedLeagueIds.length,
      },
      'Master user deleted an account'
    );

    res.json({
      message: 'User deleted successfully',
      deleted: {
        userId,
        leagues: ownedLeagueIds.length,
        predictions: predictions.deletedCount,
        groupPredictions: groupPredictions.deletedCount,
        tournamentPredictions: tournamentPredictions.deletedCount,
        devices: devices.deletedCount,
        pushSubscriptions: pushSubscriptions.deletedCount,
        contactMessages: contactMessages.deletedCount,
        leagueCreationInvites: leagueCreationInvites.deletedCount,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid delete confirmation', details: error.errors });
      return;
    }
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

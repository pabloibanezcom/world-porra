import { Router, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { League, LEAGUE_MAX_MEMBERS, type LeagueScoringScope } from '../models/League';
import { Match } from '../models/Match';
import { Prediction } from '../models/Prediction';
import { GroupPrediction } from '../models/GroupPrediction';
import { TournamentPrediction } from '../models/TournamentPrediction';
import { LeagueReminderLog, LeagueReminderType } from '../models/LeagueReminderLog';
import { PushSubscription } from '../models/PushSubscription';
import { UserDevice } from '../models/UserDevice';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { getRequestLanguage, hydrateMatches } from '../services/countryTeamService';
import { isGroupPredictionsLocked, isLeagueCreationLocked, isTournamentPredictionsLocked, isTournamentStarted } from '../services/pollConfigService';
import { serializeGroupPrediction, serializeTournamentPrediction } from '../services/predictionService';
import { currentDate } from '../utils/time';

const router = Router();

type PaymentSettingsInput = {
  entryFee: number;
  payoutSplits: Array<{ position: number; amount: number }>;
};

const INVITE_CODE_LENGTH = 8;
const INVITE_CODE_MIN_LENGTH = 6;
const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DEFAULT_LEAGUE_SCORING_SCOPE: LeagueScoringScope = 'FULL_TOURNAMENT';
const KNOCKOUT_LEAGUE_SCORING_SCOPE: LeagueScoringScope = 'KNOCKOUT_ONLY';

function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function generateInviteCode(): string {
  return Array.from({ length: INVITE_CODE_LENGTH }, () =>
    INVITE_CODE_ALPHABET[crypto.randomInt(INVITE_CODE_ALPHABET.length)]
  ).join('');
}

async function generateUniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = generateInviteCode();
    const existingLeague = await League.exists({ inviteCode });
    if (!existingLeague) {
      return inviteCode;
    }
  }

  throw new Error('Unable to generate a unique invite code');
}

function isLeagueAdmin(
  league: { ownerId: { toString(): string }; members: Array<{ userId: { toString(): string }; isAdmin?: boolean }> },
  userId: string
): boolean {
  if (league.ownerId.toString() === userId) {
    return true;
  }

  return league.members.some((member) => member.userId.toString() === userId && member.isAdmin);
}

async function isMasterUser(userId?: string): Promise<boolean> {
  if (!userId) return false;

  const user = await User.findById(userId).select('isMaster').lean();
  return !!user?.isMaster;
}

async function canManageLeague(
  league: { ownerId: { toString(): string }; members: Array<{ userId: { toString(): string }; isAdmin?: boolean }> },
  userId?: string
): Promise<boolean> {
  if (!userId) return false;
  if (isLeagueAdmin(league, userId)) return true;

  return isMasterUser(userId);
}

async function notifyMastersOfNewLeague(league: { _id: unknown; name: string }, creator: { _id: unknown; name: string }): Promise<void> {
  try {
    const masterUsers = await User.find({
      isMaster: true,
      _id: { $ne: creator._id },
    })
      .select('_id')
      .lean();

    if (masterUsers.length === 0) return;

    const { sendToUsers } = await import('../services/pushService.js');
    await sendToUsers(
      masterUsers.map((masterUser) => String(masterUser._id)),
      {
        title: 'New league created',
        body: `${creator.name} created ${league.name}.`,
        url: '/',
      }
    );
  } catch (error) {
    logger.error({ err: error, leagueId: String(league._id) }, 'Failed to notify master users about new league');
  }
}

const paymentSettingsSchema = z
  .object({
    entryFee: z.coerce.number().min(0).max(100000),
    payoutSplits: z
      .array(
        z.object({
          position: z.coerce.number().int().min(1).max(10),
          amount: z.coerce.number().min(0).max(100000),
        })
      )
      .min(1)
      .max(10),
  })
  .transform((settings): PaymentSettingsInput => settings as PaymentSettingsInput);

const leagueScoringScopeSchema = z.enum(['FULL_TOURNAMENT', 'KNOCKOUT_ONLY']);

const createLeagueSchema = z.object({
  name: z.string().min(1).max(50),
  scoringScope: leagueScoringScopeSchema.default(DEFAULT_LEAGUE_SCORING_SCOPE),
  paymentSettings: paymentSettingsSchema.optional(),
});

const joinLeagueSchema = z.object({
  inviteCode: z.string().trim().min(INVITE_CODE_MIN_LENGTH).max(INVITE_CODE_LENGTH).transform(normalizeInviteCode),
});

const leagueOrderSchema = z.object({
  leagueIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).max(200),
});

const setAdminSchema = z.object({
  userId: z.string().min(1),
});

const setMemberPaymentSchema = z.object({
  hasPaid: z.boolean(),
});

function validatePayoutSplits(
  splits: Array<{ position: number; amount: number }>,
  entryFee: number,
  memberCount: number
) {
  const positions = new Set<number>();
  for (const split of splits) {
    if (positions.has(split.position)) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ['payoutSplits'],
          message: 'Payout positions must be unique',
        },
      ]);
    }
    positions.add(split.position);
  }

  const totalPayout = splits.reduce((sum, split) => sum + split.amount, 0);
  const pot = entryFee * memberCount;
  if (totalPayout > pot) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ['payoutSplits'],
        message: 'Payout amounts cannot exceed the league pot',
      },
    ]);
  }
}

function sortLeaguesForUser<T extends { _id: unknown; createdAt?: Date | string }>(leagues: T[], leagueOrder: unknown[] = []): T[] {
  const order = new Map(leagueOrder.map((id, index) => [String(id), index]));
  return [...leagues].sort((a, b) => {
    const aOrder = order.get((a._id as any).toString());
    const bOrder = order.get((b._id as any).toString());

    if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
    if (aOrder !== undefined) return -1;
    if (bOrder !== undefined) return 1;

    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aCreated - bCreated;
  });
}

async function getVisibleLeagueQuery(userId?: string) {
  return (await isMasterUser(userId)) ? {} : { 'members.userId': userId };
}

function getLeagueScoringScope(league: { scoringScope?: LeagueScoringScope | null }): LeagueScoringScope {
  return league.scoringScope ?? DEFAULT_LEAGUE_SCORING_SCOPE;
}

function memberUserId(member: { userId: unknown }): string {
  const value = member.userId as any;
  return String(value?._id ?? value?.id ?? value ?? '');
}

function addTotalsToMap(totalsByUserId: Map<string, number>, rows: Array<{ _id: unknown; total: number }>) {
  for (const { _id, total } of rows) {
    const userId = String(_id);
    totalsByUserId.set(userId, (totalsByUserId.get(userId) ?? 0) + total);
  }
}

async function calculateLeagueMemberTotals(league: {
  scoringScope?: LeagueScoringScope | null;
  members: Array<{ userId: unknown }>;
}) {
  const memberIds = Array.from(new Set(league.members.map(memberUserId).filter((id) => Types.ObjectId.isValid(id))));
  const totalsByUserId = new Map(memberIds.map((id) => [id, 0]));
  if (memberIds.length === 0) return totalsByUserId;

  const userObjectIds = memberIds.map((id) => new Types.ObjectId(id));
  const scope = getLeagueScoringScope(league);
  const predictionPipeline: any[] = [
    { $match: { userId: { $in: userObjectIds }, points: { $ne: null } } },
  ];

  if (scope === KNOCKOUT_LEAGUE_SCORING_SCOPE) {
    predictionPipeline.push(
      { $lookup: { from: 'matches', localField: 'matchId', foreignField: '_id', as: 'match' } },
      { $unwind: '$match' },
      { $match: { 'match.stage': { $ne: 'GROUP' } } }
    );
  }

  predictionPipeline.push({ $group: { _id: '$userId', total: { $sum: '$points' } } });

  const [predictionTotals, groupPredictionTotals, tournamentPredictionTotals] = await Promise.all([
    Prediction.aggregate<{ _id: unknown; total: number }>(predictionPipeline),
    scope === DEFAULT_LEAGUE_SCORING_SCOPE
      ? GroupPrediction.aggregate<{ _id: unknown; total: number }>([
        { $match: { userId: { $in: userObjectIds }, points: { $ne: null } } },
        { $group: { _id: '$userId', total: { $sum: '$points' } } },
      ])
      : Promise.resolve([]),
    TournamentPrediction.aggregate<{ _id: unknown; total: number }>([
      { $match: { userId: { $in: userObjectIds }, points: { $ne: null } } },
      { $group: { _id: '$userId', total: { $sum: '$points' } } },
    ]),
  ]);

  addTotalsToMap(totalsByUserId, predictionTotals);
  addTotalsToMap(totalsByUserId, groupPredictionTotals);
  addTotalsToMap(totalsByUserId, tournamentPredictionTotals);

  return totalsByUserId;
}

async function attachLeagueMemberTotals<T extends { scoringScope?: LeagueScoringScope | null; members: Array<{ userId: unknown; totalPoints?: number }> }>(
  league: T | null
): Promise<T | null> {
  if (!league) return league;

  const totalsByUserId = await calculateLeagueMemberTotals(league);
  for (const member of league.members) {
    const id = memberUserId(member);
    const totalPoints = totalsByUserId.get(id) ?? 0;
    member.totalPoints = totalPoints;
    if (member.userId && typeof member.userId === 'object') {
      (member.userId as any).totalPoints = totalPoints;
    }
  }

  return league;
}

async function isKnockoutLeagueCreationLocked(): Promise<boolean> {
  const firstKnockoutMatch = await Match.findOne({ stage: { $ne: 'GROUP' } })
    .sort({ utcDate: 1 })
    .select('utcDate')
    .lean();

  return !!firstKnockoutMatch?.utcDate && currentDate() >= firstKnockoutMatch.utcDate;
}

router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, paymentSettings, scoringScope } = createLeagueSchema.parse(req.body);
    if (paymentSettings) {
      validatePayoutSplits(paymentSettings.payoutSplits, paymentSettings.entryFee, 1);
    }
    const user = await User.findById(req.userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const existingLeague = await League.exists({ ownerId: req.userId });
    if (existingLeague) {
      res.status(403).json({ error: 'You can only create one league' });
      return;
    }

    const leagueCreationClosed =
      (await isLeagueCreationLocked()) &&
      (scoringScope !== KNOCKOUT_LEAGUE_SCORING_SCOPE || await isKnockoutLeagueCreationLocked());
    if (leagueCreationClosed) {
      res.status(400).json({ error: 'League creation is closed.' });
      return;
    }

    const league = await League.create({
      name,
      inviteCode: await generateUniqueInviteCode(),
      ownerId: req.userId,
      maxMembers: LEAGUE_MAX_MEMBERS,
      scoringScope,
      members: [{ userId: req.userId, isAdmin: true, hasPaid: false }],
      ...(paymentSettings ? { paymentSettings } : {}),
    });

    await notifyMastersOfNewLeague(league, user);

    res.status(201).json({ league });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid league data', details: error.errors });
      return;
    }
    throw error;
  }
});

router.post('/join', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { inviteCode } = joinLeagueSchema.parse(req.body);

    const league = await League.findOne({ inviteCode: new RegExp(`^${escapeRegex(inviteCode)}$`, 'i') });
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    const memberLimit = Math.min(league.maxMembers ?? LEAGUE_MAX_MEMBERS, LEAGUE_MAX_MEMBERS);
    if (league.members.length >= memberLimit) {
      res.status(400).json({ error: 'League is full' });
      return;
    }

    const alreadyMember = league.members.some((m) => m.userId.toString() === req.userId);
    if (alreadyMember) {
      res.status(400).json({ error: 'You are already a member of this league' });
      return;
    }

    league.members.push({ userId: req.userId as any, joinedAt: new Date(), isAdmin: false, hasPaid: false });
    await league.save();

    res.json({ league });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid invite code' });
      return;
    }
    throw error;
  }
});

router.get('/invite/:inviteCode', async (req, res: Response): Promise<void> => {
  try {
    const { inviteCode } = joinLeagueSchema.parse({ inviteCode: req.params.inviteCode });
    const league = await League.findOne({ inviteCode: new RegExp(`^${escapeRegex(inviteCode)}$`, 'i') })
      .select('name inviteCode')
      .lean();

    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    res.json({ league: { name: league.name, inviteCode: league.inviteCode } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid invite code' });
      return;
    }
    throw error;
  }
});

router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findById(req.userId).select('leagueOrder').lean();
  const query = await getVisibleLeagueQuery(req.userId);
  const leagues = await League.find(query)
    .populate('ownerId', 'name avatarUrl')
    .populate('members.userId', 'name avatarUrl totalPoints')
    .lean();
  await Promise.all(leagues.map((league) => attachLeagueMemberTotals(league)));

  res.json({ leagues: sortLeaguesForUser(leagues, user?.leagueOrder ?? []) });
});

router.patch('/order', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { leagueIds } = leagueOrderSchema.parse(req.body);
    const uniqueLeagueIds = Array.from(new Set(leagueIds));
    if (uniqueLeagueIds.length !== leagueIds.length) {
      res.status(400).json({ error: 'League order cannot contain duplicates' });
      return;
    }

    const user = await User.findById(req.userId).select('leagueOrder');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const query = await getVisibleLeagueQuery(req.userId);
    const visibleLeagues = await League.find(query)
      .select('_id createdAt')
      .lean();
    const visibleIds = visibleLeagues.map((league) => league._id.toString());
    const visibleSet = new Set(visibleIds);

    if (uniqueLeagueIds.some((id) => !visibleSet.has(id))) {
      res.status(400).json({ error: 'League order contains leagues this user cannot access' });
      return;
    }

    const orderedVisibleIds = [
      ...uniqueLeagueIds,
      ...sortLeaguesForUser(visibleLeagues, user.leagueOrder).map((league) => league._id.toString()).filter((id) => !uniqueLeagueIds.includes(id)),
    ];
    const existingHiddenOrder = user.leagueOrder.map((id) => id.toString()).filter((id) => !visibleSet.has(id));
    user.leagueOrder = [...orderedVisibleIds, ...existingHiddenOrder] as any;
    await user.save();

    const leagues = await League.find(query)
      .populate('ownerId', 'name avatarUrl')
      .populate('members.userId', 'name avatarUrl totalPoints')
      .lean();
    await Promise.all(leagues.map((league) => attachLeagueMemberTotals(league)));

    res.json({ leagues: sortLeaguesForUser(leagues, user.leagueOrder) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid league order', details: error.errors });
      return;
    }
    throw error;
  }
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const league = await League.findById(req.params.id)
    .populate('members.userId', 'name avatarUrl totalPoints')
    .populate('ownerId', 'name avatarUrl')
    .lean();

  if (!league) {
    res.status(404).json({ error: 'League not found' });
    return;
  }

  const isMember = league.members.some((m) => (m.userId as any)._id?.toString() === req.userId);
  if (!isMember && !(await isMasterUser(req.userId))) {
    res.status(403).json({ error: 'You are not a member of this league' });
    return;
  }

  await attachLeagueMemberTotals(league);

  // Sort members by points descending for leaderboard
  league.members.sort((a, b) => {
    const aPoints = (a.userId as any)?.totalPoints ?? 0;
    const bPoints = (b.userId as any)?.totalPoints ?? 0;
    return bPoints - aPoints;
  });

  res.json({ league });
});

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const league = await League.findById(req.params.id);
  if (!league) {
    res.status(404).json({ error: 'League not found' });
    return;
  }

  if (league.ownerId.toString() !== req.userId && !(await isMasterUser(req.userId))) {
    res.status(403).json({ error: 'Only the league owner can delete this league' });
    return;
  }

  await league.deleteOne();
  res.json({ message: 'League deleted successfully' });
});

router.patch('/:id/payments', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const paymentSettings = paymentSettingsSchema.parse(req.body);

    const league = await League.findById(req.params.id);
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    if (!(await canManageLeague(league, req.userId))) {
      res.status(403).json({ error: 'Only league admins can manage payments' });
      return;
    }

    if (await isTournamentStarted()) {
      res.status(400).json({ error: 'Payment rules are locked after the tournament starts' });
      return;
    }

    validatePayoutSplits(paymentSettings.payoutSplits, paymentSettings.entryFee, league.members.length);

    league.paymentSettings = paymentSettings;
    await league.save();
    const updatedLeague = await League.findById(league._id)
      .populate('members.userId', 'name avatarUrl totalPoints')
      .populate('ownerId', 'name avatarUrl')
      .lean();
    await attachLeagueMemberTotals(updatedLeague);

    res.json({ league: updatedLeague });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid payment settings', details: error.errors });
      return;
    }
    throw error;
  }
});

router.patch('/:id/members/:userId/payment', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { hasPaid } = setMemberPaymentSchema.parse(req.body);
    const league = await League.findById(req.params.id);
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    if (!(await canManageLeague(league, req.userId))) {
      res.status(403).json({ error: 'Only league admins can manage payments' });
      return;
    }

    const member = league.members.find((entry) => entry.userId.toString() === req.params.userId);
    if (!member) {
      res.status(404).json({ error: 'League member not found' });
      return;
    }

    member.hasPaid = hasPaid;
    member.paidAt = hasPaid ? new Date() : null;
    await league.save();

    const updatedLeague = await League.findById(league._id)
      .populate('members.userId', 'name avatarUrl totalPoints')
      .populate('ownerId', 'name avatarUrl')
      .lean();
    await attachLeagueMemberTotals(updatedLeague);

    res.json({ league: updatedLeague });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid payment payload', details: error.errors });
      return;
    }
    throw error;
  }
});

router.post('/:id/admins', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = setAdminSchema.parse(req.body);
    const league = await League.findById(req.params.id);

    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    if (!(await canManageLeague(league, req.userId))) {
      res.status(403).json({ error: 'Only league admins can manage admins' });
      return;
    }

    const member = league.members.find((entry) => entry.userId.toString() === userId);
    if (!member) {
      res.status(400).json({ error: 'User must join the league before becoming admin' });
      return;
    }

    member.isAdmin = true;
    await league.save();

    res.json({ league });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid admin payload', details: error.errors });
      return;
    }
    throw error;
  }
});

router.delete('/:id/admins/:userId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const league = await League.findById(req.params.id);

  if (!league) {
    res.status(404).json({ error: 'League not found' });
    return;
  }

  if (!(await canManageLeague(league, req.userId))) {
    res.status(403).json({ error: 'Only league admins can manage admins' });
    return;
  }

  if (league.ownerId.toString() === req.params.userId) {
    res.status(400).json({ error: 'The league owner must remain an admin' });
    return;
  }

  const member = league.members.find((entry) => entry.userId.toString() === req.params.userId);
  if (!member) {
    res.status(404).json({ error: 'League member not found' });
    return;
  }

  if (!member.isAdmin) {
    res.status(400).json({ error: 'This member is not currently an admin' });
    return;
  }

  member.isAdmin = false;

  await league.save();
  res.json({ league });
});

const notifyLeagueSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(300),
});

const PICK_REMINDER_LOOKAHEAD_HOURS = 24;
const PICK_LOCK_MINUTES_BEFORE = 5;
const REMINDER_COOLDOWN_HOURS = 2;

function getPickLockTime(match: { utcDate: Date }): Date {
  return new Date(match.utcDate.getTime() - PICK_LOCK_MINUTES_BEFORE * 60 * 1000);
}

function hasConfirmedTeams(match: { homeTeamCode: string; awayTeamCode: string }): boolean {
  return ![match.homeTeamCode, match.awayTeamCode].some((code) => code.trim().toUpperCase() === 'TBD');
}

async function enforceReminderCooldown(leagueId: string, type: LeagueReminderType) {
  const now = currentDate();
  const cooldownStart = new Date(now.getTime() - REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000);
  const recentReminder = await LeagueReminderLog.findOne({
    leagueId,
    type,
    sentAt: { $gt: cooldownStart },
  })
    .sort({ sentAt: -1 })
    .lean();

  if (!recentReminder) return null;

  return new Date(new Date(recentReminder.sentAt).getTime() + REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000);
}

async function logReminder(input: {
  leagueId: string;
  senderId: string;
  type: LeagueReminderType;
  recipients: number;
  metadata?: Record<string, unknown>;
}) {
  await LeagueReminderLog.create({
    leagueId: input.leagueId,
    senderId: input.senderId,
    type: input.type,
    recipients: input.recipients,
    sentAt: currentDate(),
    metadata: input.metadata,
  });
}

async function getMissingPickReminderPreview(league: {
  members: Array<{ userId: { toString(): string } }>;
}) {
  const now = currentDate();
  const reminderWindowEnd = new Date(now.getTime() + PICK_REMINDER_LOOKAHEAD_HOURS * 60 * 60 * 1000);
  const candidateMatches = await Match.find({
    status: 'SCHEDULED',
    utcDate: {
      $gt: now,
      $lte: new Date(reminderWindowEnd.getTime() + PICK_LOCK_MINUTES_BEFORE * 60 * 1000),
    },
  })
    .select('_id utcDate homeTeamCode awayTeamCode')
    .lean();

  const matchesToPick = candidateMatches.filter((match) => {
    const lockTime = getPickLockTime(match);
    return hasConfirmedTeams(match) && lockTime > now && lockTime <= reminderWindowEnd;
  });

  const memberIds = league.members.map((member) => member.userId.toString());
  if (matchesToPick.length === 0 || memberIds.length === 0) {
    return { matchesToPick, missingMemberIds: [] };
  }

  const matchIds = matchesToPick.map((match) => match._id);
  const predictions = await Prediction.find({
    userId: { $in: memberIds },
    matchId: { $in: matchIds },
  })
    .select('userId matchId')
    .lean();

  const pickedByUser = new Map<string, Set<string>>();
  predictions.forEach((prediction) => {
    const userId = prediction.userId.toString();
    const picks = pickedByUser.get(userId) ?? new Set<string>();
    picks.add(prediction.matchId.toString());
    pickedByUser.set(userId, picks);
  });

  const missingMemberIds = memberIds.filter((memberId) => {
    const picks = pickedByUser.get(memberId);
    return matchesToPick.some((match) => !picks?.has(match._id.toString()));
  });

  return { matchesToPick, missingMemberIds };
}

async function getEmailFallbackRecipients(userIds: string[]) {
  if (userIds.length === 0) return [];

  const recentStandaloneSince = new Date(currentDate().getTime() - env.EMAIL_PWA_RECENT_DAYS * 24 * 60 * 60 * 1000);
  const [users, standaloneDevices, pushSubscriptions] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select('_id email name').lean(),
    UserDevice.find({
      userId: { $in: userIds },
      displayMode: 'standalone',
      lastSeenAt: { $gte: recentStandaloneSince },
    })
      .select('userId')
      .lean(),
    PushSubscription.find({ userId: { $in: userIds } }).select('userId').lean(),
  ]);

  const standaloneUserIds = new Set(standaloneDevices.map((device) => String(device.userId)));
  const pushUserIds = new Set(pushSubscriptions.map((subscription) => String(subscription.userId)));

  return users
    .filter((user) => !standaloneUserIds.has(String(user._id)) && !pushUserIds.has(String(user._id)))
    .map((user) => ({
      userId: String(user._id),
      email: user.email,
      name: user.name,
    }));
}

function getMissingPicksDedupeKey(matchesToPick: Array<{ _id: unknown }>): string {
  return matchesToPick
    .map((match) => String(match._id))
    .sort()
    .join(',');
}

router.post('/:id/notify', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const league = await League.findById(req.params.id);
  if (!league) {
    res.status(404).json({ error: 'League not found' });
    return;
  }
  if (!(await canManageLeague(league, req.userId))) {
    res.status(403).json({ error: 'Only league admins can send notifications' });
    return;
  }
  try {
    const { title, body } = notifyLeagueSchema.parse(req.body);
    const { sendToUsers } = await import('../services/pushService.js');
    const memberIds = league.members.map((m) => m.userId.toString());
    await sendToUsers(memberIds, { title, body, url: '/' });
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid payload', details: error.errors });
      return;
    }
    throw error;
  }
});

router.post('/:id/payments/remind-unpaid', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const leagueId = String(req.params.id);
  const league = await League.findById(leagueId);
  if (!league) {
    res.status(404).json({ error: 'League not found' });
    return;
  }

  if (!(await canManageLeague(league, req.userId))) {
    res.status(403).json({ error: 'Only league admins can send payment reminders' });
    return;
  }

  const unpaidMemberIds = league.members
    .filter((member) => !member.hasPaid)
    .map((member) => member.userId.toString());

  if (unpaidMemberIds.length === 0) {
    res.status(400).json({ error: 'All league members are marked as paid' });
    return;
  }

  const cooldownUntil = await enforceReminderCooldown(leagueId, 'payment_unpaid');
  if (cooldownUntil) {
    res.status(429).json({ error: 'Payment reminders were sent recently', cooldownUntil: cooldownUntil.toISOString() });
    return;
  }

  const { sendToUsers } = await import('../services/pushService.js');
  await sendToUsers(unpaidMemberIds, {
    title: `${league.name}: payment reminder`,
    body: 'Your league admin marked your entry fee as pending.',
    url: '/',
  });
  await logReminder({
    leagueId,
    senderId: req.userId!,
    type: 'payment_unpaid',
    recipients: unpaidMemberIds.length,
  });

  res.json({ ok: true, recipients: unpaidMemberIds.length });
});

router.get('/:id/picks/remind-missing/preview', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const league = await League.findById(req.params.id);
  if (!league) {
    res.status(404).json({ error: 'League not found' });
    return;
  }

  if (!(await canManageLeague(league, req.userId))) {
    res.status(403).json({ error: 'Only league admins can preview pick reminders' });
    return;
  }

  const { matchesToPick, missingMemberIds } = await getMissingPickReminderPreview(league);
  const emailFallbackRecipients = await getEmailFallbackRecipients(missingMemberIds);
  const users = await User.find({ _id: { $in: missingMemberIds } })
    .select('name avatarUrl')
    .lean();
  const usersById = new Map(users.map((user) => [String(user._id), user]));

  res.json({
    matches: matchesToPick.length,
    recipients: missingMemberIds.length,
    emailFallbackRecipients: emailFallbackRecipients.length,
    members: missingMemberIds.map((userId) => {
      const user = usersById.get(userId);
      return {
        id: userId,
        name: user?.name || 'Player',
        avatarUrl: user?.avatarUrl || '',
      };
    }),
  });
});

router.post('/:id/picks/remind-missing', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const leagueId = String(req.params.id);
  const league = await League.findById(leagueId);
  if (!league) {
    res.status(404).json({ error: 'League not found' });
    return;
  }

  if (!(await canManageLeague(league, req.userId))) {
    res.status(403).json({ error: 'Only league admins can send pick reminders' });
    return;
  }

  const { matchesToPick, missingMemberIds } = await getMissingPickReminderPreview(league);

  if (matchesToPick.length === 0) {
    res.status(400).json({ error: 'No upcoming matches lock in the next 24 hours' });
    return;
  }

  if (missingMemberIds.length === 0) {
    res.status(400).json({ error: 'All league members have picks for upcoming matches' });
    return;
  }

  const cooldownUntil = await enforceReminderCooldown(leagueId, 'missing_picks');
  if (cooldownUntil) {
    res.status(429).json({ error: 'Pick reminders were sent recently', cooldownUntil: cooldownUntil.toISOString() });
    return;
  }

  const { sendToUsers } = await import('../services/pushService.js');
  await sendToUsers(missingMemberIds, {
    title: `${league.name}: picks reminder`,
    body: 'You have matches locking soon without picks.',
    url: '/',
  });
  const emailFallbackRecipients = await getEmailFallbackRecipients(missingMemberIds);
  const { sendMissingPickReminderEmails } = await import('../services/emailService.js');
  const emailSummary = await sendMissingPickReminderEmails({
    recipients: emailFallbackRecipients,
    leagueName: league.name,
    matchCount: matchesToPick.length,
    dedupeKey: getMissingPicksDedupeKey(matchesToPick),
  });
  await logReminder({
    leagueId,
    senderId: req.userId!,
    type: 'missing_picks',
    recipients: missingMemberIds.length,
    metadata: { matches: matchesToPick.length, email: emailSummary },
  });

  res.json({
    ok: true,
    recipients: missingMemberIds.length,
    matches: matchesToPick.length,
    pushRecipients: missingMemberIds.length,
    emailRecipients: emailSummary.sent,
    emailSkipped:
      emailSummary.skippedAlreadySent +
      emailSummary.skippedQuota +
      emailSummary.skippedNotConfigured +
      emailSummary.failed,
  });
});

router.get('/:id/members/:userId/predictions', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const league = await League.findById(req.params.id);
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    const isViewer = league.members.some((m) => m.userId.toString() === req.userId);
    if (!isViewer && !(await isMasterUser(req.userId))) {
      res.status(403).json({ error: 'Not a league member' });
      return;
    }

    const targetUserId = req.params.userId;
    const targetInLeague = league.members.some((m) => m.userId.toString() === targetUserId);
    if (!targetInLeague) {
      res.status(404).json({ error: 'Member not found in league' });
      return;
    }

    const canViewPending = await canManageLeague(league, req.userId);
    const matchScopeQuery = getLeagueScoringScope(league) === KNOCKOUT_LEAGUE_SCORING_SCOPE
      ? { stage: { $ne: 'GROUP' } }
      : {};
    const [rawFinishedMatches, rawUpcomingMatches] = await Promise.all([
      Match.find({ ...matchScopeQuery, status: { $in: ['LIVE', 'FINISHED'] } }).sort({ utcDate: -1 }).lean(),
      canViewPending ? Match.find({ ...matchScopeQuery, status: 'SCHEDULED' }).sort({ utcDate: 1 }).lean() : Promise.resolve([]),
    ]);
    const language = getRequestLanguage(req);
    const [finishedMatches, upcomingMatches] = await Promise.all([
      hydrateMatches(rawFinishedMatches, language),
      hydrateMatches(rawUpcomingMatches, language),
    ]);

    const finishedIds = finishedMatches.map((m) => m._id);
    const upcomingIds = upcomingMatches.map((m) => m._id);

    const [finishedPredictions, upcomingPredictions, groupPredictionsLocked, tournamentPredictionsLocked] = await Promise.all([
      Prediction.find({ userId: targetUserId, matchId: { $in: finishedIds } }).lean(),
      Prediction.find({ userId: targetUserId, matchId: { $in: upcomingIds } }).select('matchId').lean(),
      isGroupPredictionsLocked(),
      isTournamentPredictionsLocked(),
    ]);

    const [groupPredictions, tournamentPrediction] = await Promise.all([
      groupPredictionsLocked && getLeagueScoringScope(league) === DEFAULT_LEAGUE_SCORING_SCOPE
        ? GroupPrediction.find({ userId: targetUserId }).sort({ group: 1 }).lean()
        : Promise.resolve([]),
      tournamentPredictionsLocked
        ? TournamentPrediction.findOne({ userId: targetUserId }).lean()
        : Promise.resolve(null),
    ]);

    const pickedSet = new Set(upcomingPredictions.map((p) => p.matchId.toString()));
    const matchPoints = finishedPredictions.reduce((total, prediction) => total + (prediction.points ?? 0), 0);
    const groupPoints = groupPredictions.reduce((total, prediction) => total + (prediction.points ?? 0), 0);
    const tournamentPoints = tournamentPrediction?.points ?? 0;

    res.json({
      pointsBreakdown: {
        matches: matchPoints,
        groups: groupPoints,
        tournament: tournamentPoints,
        total: matchPoints + groupPoints + tournamentPoints,
      },
      finishedMatches: finishedMatches.map((m) => {
        const pred = finishedPredictions.find((p) => p.matchId.toString() === m._id.toString());
        return {
          _id: String(m._id),
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          utcDate: m.utcDate,
          stage: m.stage,
          status: m.status,
          group: m.group,
          result: m.result,
          prediction: pred
            ? { homeGoals: pred.homeGoals, awayGoals: pred.awayGoals, points: pred.points }
            : null,
        };
      }),
      upcomingMatches: upcomingMatches.map((m) => ({
        _id: String(m._id),
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        utcDate: m.utcDate,
        stage: m.stage,
        group: m.group,
        hasPick: pickedSet.has(m._id.toString()),
      })),
      groupPredictions: await Promise.all(groupPredictions.map((prediction) => serializeGroupPrediction(prediction, language))),
      tournamentPrediction: await serializeTournamentPrediction(tournamentPrediction, language),
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id/leave', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const league = await League.findById(req.params.id);
  if (!league) {
    res.status(404).json({ error: 'League not found' });
    return;
  }

  if (league.ownerId.toString() === req.userId && !(await isMasterUser(req.userId))) {
    res.status(400).json({ error: 'The league owner cannot leave the league' });
    return;
  }

  const wasMember = league.members.some((m) => m.userId.toString() === req.userId);
  if (!wasMember) {
    res.status(400).json({ error: 'You are not a member of this league' });
    return;
  }

  league.members = league.members.filter((m) => m.userId.toString() !== req.userId);

  await league.save();
  res.json({ message: 'Left league successfully' });
});

export default router;

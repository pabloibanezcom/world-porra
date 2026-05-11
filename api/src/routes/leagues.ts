import { Router, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { League, LEAGUE_MAX_MEMBERS } from '../models/League';
import { Match } from '../models/Match';
import { Prediction } from '../models/Prediction';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { getRequestLanguage, hydrateMatches } from '../services/countryTeamService';
import { isLeagueCreationLocked } from '../services/pollConfigService';
import { canUserCreateLeagues } from './auth';

const router = Router();

const INVITE_CODE_LENGTH = 8;
const INVITE_CODE_MIN_LENGTH = 6;
const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

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

const createLeagueSchema = z.object({
  name: z.string().min(1).max(50),
});

const joinLeagueSchema = z.object({
  inviteCode: z.string().trim().min(INVITE_CODE_MIN_LENGTH).max(INVITE_CODE_LENGTH).transform((code) => code.toUpperCase()),
});

const setAdminSchema = z.object({
  userId: z.string().min(1),
});

router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name } = createLeagueSchema.parse(req.body);
    const user = await User.findById(req.userId);

    if (!user || !canUserCreateLeagues(user)) {
      res.status(403).json({ error: 'You are not allowed to create leagues' });
      return;
    }

    if (await isLeagueCreationLocked()) {
      res.status(400).json({ error: 'League creation is closed.' });
      return;
    }

    const league = await League.create({
      name,
      inviteCode: await generateUniqueInviteCode(),
      ownerId: req.userId,
      maxMembers: LEAGUE_MAX_MEMBERS,
      members: [{ userId: req.userId, isAdmin: true }],
    });

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

    const league = await League.findOne({ inviteCode });
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

    league.members.push({ userId: req.userId as any, joinedAt: new Date(), isAdmin: false });
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

router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const leagues = await League.find({ 'members.userId': req.userId })
    .populate('ownerId', 'name avatarUrl')
    .populate('members.userId', 'name avatarUrl totalPoints')
    .lean();

  res.json({ leagues });
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
  if (!isMember) {
    res.status(403).json({ error: 'You are not a member of this league' });
    return;
  }

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

  if (league.ownerId.toString() !== req.userId) {
    res.status(403).json({ error: 'Only the league owner can delete this league' });
    return;
  }

  await league.deleteOne();
  res.json({ message: 'League deleted successfully' });
});

router.post('/:id/admins', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = setAdminSchema.parse(req.body);
    const league = await League.findById(req.params.id);

    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    if (!isLeagueAdmin(league, req.userId!)) {
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

  if (!isLeagueAdmin(league, req.userId!)) {
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

router.post('/:id/notify', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const league = await League.findById(req.params.id);
  if (!league) {
    res.status(404).json({ error: 'League not found' });
    return;
  }
  if (!isLeagueAdmin(league, req.userId!)) {
    res.status(403).json({ error: 'Only league admins can send notifications' });
    return;
  }
  try {
    const { title, body } = notifyLeagueSchema.parse(req.body);
    const { sendToUsers } = await import('../services/pushService');
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

router.get('/:id/members/:userId/predictions', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const league = await League.findById(req.params.id);
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    const isViewer = league.members.some((m) => m.userId.toString() === req.userId);
    if (!isViewer) {
      res.status(403).json({ error: 'Not a league member' });
      return;
    }

    const targetUserId = req.params.userId;
    const targetInLeague = league.members.some((m) => m.userId.toString() === targetUserId);
    if (!targetInLeague) {
      res.status(404).json({ error: 'Member not found in league' });
      return;
    }

    const [rawFinishedMatches, rawUpcomingMatches] = await Promise.all([
      Match.find({ status: 'FINISHED' }).lean(),
      Match.find({ status: 'SCHEDULED' }).sort({ utcDate: 1 }).lean(),
    ]);
    const language = getRequestLanguage(req);
    const [finishedMatches, upcomingMatches] = await Promise.all([
      hydrateMatches(rawFinishedMatches, language),
      hydrateMatches(rawUpcomingMatches, language),
    ]);

    const finishedIds = finishedMatches.map((m) => m._id);
    const upcomingIds = upcomingMatches.map((m) => m._id);

    const [finishedPredictions, upcomingPredictions] = await Promise.all([
      Prediction.find({ userId: targetUserId, matchId: { $in: finishedIds } }).lean(),
      Prediction.find({ userId: targetUserId, matchId: { $in: upcomingIds } }).select('matchId').lean(),
    ]);

    const pickedSet = new Set(upcomingPredictions.map((p) => p.matchId.toString()));

    res.json({
      finishedMatches: finishedMatches.map((m) => {
        const pred = finishedPredictions.find((p) => p.matchId.toString() === m._id.toString());
        return {
          _id: String(m._id),
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          utcDate: m.utcDate,
          stage: m.stage,
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

  if (league.ownerId.toString() === req.userId) {
    res.status(400).json({ error: 'The league owner cannot leave the league' });
    return;
  }

  league.members = league.members.filter((m) => m.userId.toString() !== req.userId);

  await league.save();
  res.json({ message: 'Left league successfully' });
});

export default router;

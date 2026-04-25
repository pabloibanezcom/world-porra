import { Router, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { League } from '../models/League';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';

const router = Router();

function generateInviteCode(): string {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
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
  inviteCode: z.string().length(6),
});

const setAdminSchema = z.object({
  userId: z.string().min(1),
});

router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name } = createLeagueSchema.parse(req.body);
    const user = await User.findById(req.userId);

    if (!user?.isMaster) {
      res.status(403).json({ error: 'Only the master user can create leagues' });
      return;
    }

    const league = await League.create({
      name,
      inviteCode: generateInviteCode(),
      ownerId: req.userId,
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

    const league = await League.findOne({ inviteCode: inviteCode.toUpperCase() });
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    if (league.members.length >= league.maxMembers) {
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

import { Router, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { League } from '../models/League';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

function generateInviteCode(): string {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

const createLeagueSchema = z.object({
  name: z.string().min(1).max(50),
});

const joinLeagueSchema = z.object({
  inviteCode: z.string().length(6),
});

router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name } = createLeagueSchema.parse(req.body);

    const league = await League.create({
      name,
      inviteCode: generateInviteCode(),
      ownerId: req.userId,
      members: [{ userId: req.userId, totalPoints: 0 }],
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

    league.members.push({ userId: req.userId as any, totalPoints: 0, joinedAt: new Date() });
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
    .lean();

  res.json({ leagues });
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const league = await League.findById(req.params.id)
    .populate('members.userId', 'name avatarUrl')
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
  league.members.sort((a, b) => b.totalPoints - a.totalPoints);

  res.json({ league });
});

router.delete('/:id/leave', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const league = await League.findById(req.params.id);
  if (!league) {
    res.status(404).json({ error: 'League not found' });
    return;
  }

  league.members = league.members.filter((m) => m.userId.toString() !== req.userId);

  if (league.members.length === 0) {
    await league.deleteOne();
    res.json({ message: 'League deleted (no members remaining)' });
    return;
  }

  // Transfer ownership if owner leaves
  if (league.ownerId.toString() === req.userId) {
    league.ownerId = league.members[0].userId;
  }

  await league.save();
  res.json({ message: 'Left league successfully' });
});

export default router;

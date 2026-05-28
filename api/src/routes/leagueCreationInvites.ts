import { Router, Response } from 'express';
import crypto from 'crypto';
import { LeagueCreationInvite } from '../models/LeagueCreationInvite';
import { User } from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const INVITE_EXPIRY_DAYS = 7;

function generateToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Master only: generate a new invite token
router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findById(req.userId);
  if (!user?.isMaster) {
    res.status(403).json({ error: 'Only the master user can create league creation invites' });
    return;
  }

  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

  const invite = await LeagueCreationInvite.create({
    token,
    createdBy: req.userId,
    expiresAt,
  });

  res.status(201).json({ invite: { token: invite.token, expiresAt: invite.expiresAt } });
});

// Master only: list all issued invites
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findById(req.userId);
  if (!user?.isMaster) {
    res.status(403).json({ error: 'Only the master user can view league creation invites' });
    return;
  }

  const invites = await LeagueCreationInvite.find()
    .populate('createdBy', 'name email')
    .populate('usedBy', 'name email')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ invites });
});

// Public: check if an invite token is valid (not used, not expired)
router.get('/:token', async (req, res: Response): Promise<void> => {
  const invite = await LeagueCreationInvite.findOne({ token: req.params.token }).lean();

  if (!invite) {
    res.status(404).json({ error: 'Invite not found' });
    return;
  }

  if (invite.usedBy) {
    res.status(410).json({ error: 'This invite has already been used' });
    return;
  }

  if (new Date(invite.expiresAt) < new Date()) {
    res.status(410).json({ error: 'This invite has expired' });
    return;
  }

  res.json({ valid: true, expiresAt: invite.expiresAt });
});

// Authenticated: redeem an invite — grants canCreateLeagues on the current user
router.post('/:token/redeem', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const invite = await LeagueCreationInvite.findOne({ token: req.params.token });

  if (!invite) {
    res.status(404).json({ error: 'Invite not found' });
    return;
  }

  if (invite.usedBy) {
    res.status(410).json({ error: 'This invite has already been used' });
    return;
  }

  if (invite.expiresAt < new Date()) {
    res.status(410).json({ error: 'This invite has expired' });
    return;
  }

  invite.usedBy = req.userId as any;
  invite.usedAt = new Date();
  await invite.save();

  await User.findByIdAndUpdate(req.userId, { canCreateLeagues: true });

  res.json({ ok: true });
});

export default router;

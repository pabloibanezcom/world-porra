import { Router, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User';
import { env } from '../config/env';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { hashPassword, verifyPassword } from '../utils/password';

const router = Router();
const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(80),
  password: z.string().min(8).max(128),
});

const passwordLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const googleAuthSchema = z.object({
  idToken: z.string().min(1),
});

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isMasterEmail(email: string): boolean {
  return !!env.MASTER_USER_EMAIL && normalizeEmail(env.MASTER_USER_EMAIL) === normalizeEmail(email);
}

function signToken(user: { _id: unknown; email: string; isMaster?: boolean }): string {
  return jwt.sign(
    { userId: String(user._id), email: user.email, isMaster: !!user.isMaster },
    env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function serializeUser(user: {
  _id: unknown;
  email: string;
  name: string;
  avatarUrl: string;
  isMaster?: boolean;
  totalPoints?: number;
}) {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    isMaster: !!user.isMaster,
    totalPoints: user.totalPoints ?? 0,
  };
}

router.post('/register', async (req, res: Response): Promise<void> => {
  try {
    const { email, name, password } = registerSchema.parse(req.body);
    const normalizedEmail = normalizeEmail(email);
    const passwordHash = await hashPassword(password);

    const existingUser = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
    let user;

    if (existingUser) {
      if (existingUser.passwordHash) {
        res.status(409).json({ error: 'An account with this email already exists' });
        return;
      }

      existingUser.name = name;
      existingUser.passwordHash = passwordHash;
      existingUser.isMaster = existingUser.isMaster || isMasterEmail(normalizedEmail);
      user = await existingUser.save();
    } else {
      user = await User.create({
        email: normalizedEmail,
        name,
        passwordHash,
        isMaster: isMasterEmail(normalizedEmail),
      });
    }

    const token = signToken(user);
    res.status(201).json({ token, user: serializeUser(user) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid registration data', details: error.errors });
      return;
    }
    throw error;
  }
});

router.post('/login', async (req, res: Response): Promise<void> => {
  try {
    const { email, password } = passwordLoginSchema.parse(req.body);
    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
    if (!user?.passwordHash) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    user.isMaster = user.isMaster || isMasterEmail(normalizedEmail);
    await user.save();

    const token = signToken(user);
    res.json({ token, user: serializeUser(user) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid login data', details: error.errors });
      return;
    }
    throw error;
  }
});

router.post('/google', async (req, res: Response): Promise<void> => {
  try {
    const { idToken } = googleAuthSchema.parse(req.body);

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload?.email) {
      res.status(401).json({ error: 'Invalid Google token' });
      return;
    }

    const normalizedEmail = normalizeEmail(payload.email);
    let user = await User.findOne({ googleId: payload.sub });

    if (!user) {
      user = await User.findOne({ email: normalizedEmail });
    }

    if (user && user.googleId && user.googleId !== payload.sub) {
      res.status(409).json({ error: 'This email is already linked to a different Google account' });
      return;
    }

    if (!user) {
      user = await User.create({
        googleId: payload.sub,
        email: normalizedEmail,
        name: payload.name || normalizedEmail,
        avatarUrl: payload.picture || '',
        isMaster: isMasterEmail(normalizedEmail),
      });
    } else {
      user.googleId = payload.sub;
      user.email = normalizedEmail;
      user.name = payload.name || user.name || normalizedEmail;
      user.avatarUrl = payload.picture || user.avatarUrl || '';
      user.isMaster = user.isMaster || isMasterEmail(normalizedEmail);
      await user.save();
    }

    const token = signToken(user);
    res.json({ token, user: serializeUser(user) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'idToken is required' });
      return;
    }
    res.status(401).json({ error: 'Authentication failed' });
  }
});

// Dev-only: mock login without Google
if (env.NODE_ENV !== 'production') {
  router.post('/dev', async (_req, res: Response): Promise<void> => {
    const user = await User.findOneAndUpdate(
      { googleId: 'dev-user-001' },
      {
        googleId: 'dev-user-001',
        email: 'dev@wc2026.test',
        name: 'Dev Player',
        avatarUrl: '',
        isMaster: isMasterEmail('dev@wc2026.test'),
      },
      { upsert: true, new: true }
    );

    const token = signToken(user);
    res.json({ token, user: serializeUser(user) });
  });
}

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findById(req.userId).select('-__v');
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  user.isMaster = user.isMaster || isMasterEmail(user.email);
  await user.save();
  res.json({ user: serializeUser(user) });
});

export default router;

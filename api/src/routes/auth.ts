import { Router, Response } from 'express';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { z } from 'zod';
import { User } from '../models/User';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { hashPassword, verifyPassword } from '../utils/password';
import { getAppBaseUrl, isEmailConfigured, sendPasswordResetEmail } from '../services/emailService';

const router = Router();
const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
const PASSWORD_RESET_EXPIRES_MINUTES = 60;

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(80),
  password: z.string().min(8).max(128),
});

const passwordLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

const passwordResetConfirmSchema = z.object({
  token: z.string().min(32).max(256),
  password: z.string().min(8).max(128),
});

const googleAuthSchema = z.object({
  idToken: z.string().min(1),
});

const devLoginSchema = z
  .object({
    email: z.string().email().optional(),
    userId: z.string().min(1).optional(),
  })
  .refine((value) => !value.email || !value.userId, {
    message: 'Provide email or userId, not both',
  });

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(40),
});

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashLogValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function isMasterEmail(email: string): boolean {
  return !!env.MASTER_USER_EMAIL && normalizeEmail(env.MASTER_USER_EMAIL) === normalizeEmail(email);
}

function isLeagueCreatorEmail(email: string): boolean {
  const allowedEmails = env.LEAGUE_CREATOR_EMAILS
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);

  return allowedEmails.includes(normalizeEmail(email));
}

function isDevAuthAllowed(): boolean {
  if (env.NODE_ENV === 'test' || env.USE_IN_MEMORY_DB) return true;

  return mongoose.connection.name.startsWith('test_');
}

export function canUserCreateLeagues(user: { email: string; isMaster?: boolean; canCreateLeagues?: boolean }): boolean {
  return !!user.isMaster || !!user.canCreateLeagues || isLeagueCreatorEmail(user.email);
}

function signToken(user: { _id: unknown; email: string; isMaster?: boolean }): string {
  return jwt.sign(
    { userId: String(user._id), email: user.email, isMaster: !!user.isMaster },
    env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function generatePasswordResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashPasswordResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function buildPasswordResetUrl(token: string): string {
  const appUrl = getAppBaseUrl();
  return `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
}

function serializeUser(user: {
  _id: unknown;
  email: string;
  name: string;
  avatarUrl: string;
  isMaster?: boolean;
  canCreateLeagues?: boolean;
  totalPoints?: number;
}) {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    isMaster: !!user.isMaster,
    canCreateLeagues: canUserCreateLeagues(user),
    totalPoints: user.totalPoints ?? 0,
  };
}

async function notifyMastersOfNewUser(user: { _id: unknown; email: string; name: string; isMaster?: boolean }): Promise<void> {
  try {
    const masterUsers = await User.find({
      isMaster: true,
      _id: { $ne: user._id },
    })
      .select('_id')
      .lean();

    if (masterUsers.length === 0) return;

    const { sendToUsers } = await import('../services/pushService.js');
    await sendToUsers(
      masterUsers.map((masterUser) => String(masterUser._id)),
      {
        title: 'New user joined',
        body: `${user.name} (${user.email}) joined World Porra.`,
        url: '/',
      }
    );
  } catch (error) {
    logger.error({ err: error, userId: String(user._id) }, 'Failed to notify master users about new user');
  }
}

router.post('/register', async (req, res: Response): Promise<void> => {
  try {
    const { email, name, password } = registerSchema.parse(req.body);
    const normalizedEmail = normalizeEmail(email);
    const passwordHash = await hashPassword(password);

    const existingUser = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
    let user;
    let isNewUser = false;

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
      isNewUser = true;
    }

    if (isNewUser) {
      await notifyMastersOfNewUser(user);
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

router.post('/password/forgot', async (req, res: Response): Promise<void> => {
  try {
    const { email } = passwordResetRequestSchema.parse(req.body);
    const normalizedEmail = normalizeEmail(email);
    const emailHash = hashLogValue(normalizedEmail);

    if (!isEmailConfigured()) {
      logger.error({ emailHash }, 'Password reset email requested but email delivery is not configured');
      res.status(503).json({ error: 'Password reset emails are temporarily unavailable' });
      return;
    }

    const user = await User.findOne({ email: normalizedEmail }).select('+passwordResetTokenHash');

    if (!user) {
      logger.info({ emailHash }, 'Password reset requested for unknown email');
      res.json({ ok: true });
      return;
    }

    const resetToken = generatePasswordResetToken();
    user.passwordResetTokenHash = hashPasswordResetToken(resetToken);
    user.passwordResetExpiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000);
    await user.save();

    try {
      const emailResult = await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl: buildPasswordResetUrl(resetToken),
        expiresInMinutes: PASSWORD_RESET_EXPIRES_MINUTES,
      });

      if (emailResult.skipped) {
        user.passwordResetTokenHash = null;
        user.passwordResetExpiresAt = null;
        await user.save();
        logger.error({ userId: String(user._id), emailHash }, 'Password reset email send skipped');
        res.status(503).json({ error: 'Password reset emails are temporarily unavailable' });
        return;
      }

      logger.info(
        { userId: String(user._id), emailHash, providerMessageId: emailResult.providerMessageId ?? undefined },
        'Password reset email sent'
      );
    } catch (error) {
      logger.error({ err: error, userId: String(user._id), emailHash }, 'Password reset email send failed');
      user.passwordResetTokenHash = null;
      user.passwordResetExpiresAt = null;
      await user.save();
      res.status(503).json({ error: 'Password reset emails are temporarily unavailable' });
      return;
    }

    res.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid password reset request', details: error.errors });
      return;
    }
    throw error;
  }
});

router.post('/password/reset', async (req, res: Response): Promise<void> => {
  try {
    const { token, password } = passwordResetConfirmSchema.parse(req.body);
    const tokenHash = hashPasswordResetToken(token);
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    }).select('+passwordHash +passwordResetTokenHash');

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired password reset token' });
      return;
    }

    user.passwordHash = await hashPassword(password);
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    user.isMaster = user.isMaster || isMasterEmail(user.email);
    await user.save();

    const authToken = signToken(user);
    res.json({ token: authToken, user: serializeUser(user) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid password reset data', details: error.errors });
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
      await notifyMastersOfNewUser(user);
    } else {
      user.googleId = payload.sub;
      user.email = normalizedEmail;
      user.name = user.name || payload.name || normalizedEmail;
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

// Test-DB-only: mock login without Google/password for fast QA switching.
router.post('/dev', async (req, res: Response): Promise<void> => {
  if (!isDevAuthAllowed()) {
    res.status(403).json({ error: 'Dev login is only available for test databases' });
    return;
  }

  try {
    const { email, userId } = devLoginSchema.parse(req.body ?? {});
    let user;

    if (email) {
      user = await User.findOne({ email: normalizeEmail(email) });
    } else if (userId) {
      user = await User.findById(userId);
    } else {
      user = await User.findOneAndUpdate(
        { googleId: 'dev-user-001' },
        {
          googleId: 'dev-user-001',
          email: 'dev@worldporra.test',
          name: 'Dev Player',
          avatarUrl: '',
          isMaster: isMasterEmail('dev@worldporra.test'),
        },
        { upsert: true, new: true }
      );
    }

    if (!user) {
      res.status(404).json({ error: 'Dev user not found' });
      return;
    }

    user.isMaster = user.isMaster || isMasterEmail(user.email);
    await user.save();

    const token = signToken(user);
    res.json({ token, user: serializeUser(user) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid dev login data', details: error.errors });
      return;
    }
    throw error;
  }
});

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

router.patch('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name } = updateProfileSchema.parse(req.body);
    const user = await User.findByIdAndUpdate(req.userId, { name }, { new: true }).select('-__v');

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: serializeUser(user) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid profile data', details: error.errors });
      return;
    }
    throw error;
  }
});

export default router;

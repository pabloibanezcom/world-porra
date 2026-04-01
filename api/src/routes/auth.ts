import { Router, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User';
import { env } from '../config/env';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

const googleAuthSchema = z.object({
  idToken: z.string().min(1),
});

router.post('/google', async (req, res: Response): Promise<void> => {
  try {
    const { idToken } = googleAuthSchema.parse(req.body);

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      res.status(401).json({ error: 'Invalid Google token' });
      return;
    }

    const user = await User.findOneAndUpdate(
      { googleId: payload.sub },
      {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name || payload.email,
        avatarUrl: payload.picture || '',
      },
      { upsert: true, new: true }
    );

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, user: { id: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'idToken is required' });
      return;
    }
    res.status(401).json({ error: 'Authentication failed' });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findById(req.userId).select('-__v');
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user: { id: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl } });
});

export default router;

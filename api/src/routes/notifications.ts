import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { PushSubscription } from '../models/PushSubscription';
import { env } from '../config/env';

const router = Router();

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

router.get('/vapid-public-key', (_req: Request, res: Response) => {
  res.json({ publicKey: env.VAPID_PUBLIC_KEY ?? '' });
});

router.post('/subscribe', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { endpoint, keys } = subscribeSchema.parse(req.body);
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { userId: req.userId, endpoint, keys },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid subscription data' });
      return;
    }
    throw error;
  }
});

router.delete('/subscribe', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { endpoint } = req.body;
  if (!endpoint) {
    res.status(400).json({ error: 'endpoint required' });
    return;
  }
  await PushSubscription.deleteOne({ userId: req.userId, endpoint });
  res.json({ ok: true });
});

router.post('/test', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { sendToUser } = await import('../services/pushService');
  await sendToUser(req.userId!, {
    title: 'Test notification',
    body: 'Push notifications are working!',
    url: '/',
  });
  res.json({ ok: true });
});

const broadcastSchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(300),
});

router.post('/broadcast', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await (await import('../models/User')).User.findById(req.userId);
  if (!user?.isMaster) {
    res.status(403).json({ error: 'Master access required' });
    return;
  }
  try {
    const { title, body } = broadcastSchema.parse(req.body);
    const { sendToAll } = await import('../services/pushService');
    await sendToAll({ title, body, url: '/' });
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid payload', details: error.errors });
      return;
    }
    throw error;
  }
});

export default router;

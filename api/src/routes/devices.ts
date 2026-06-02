import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { UserDevice } from '../models/UserDevice';

const router = Router();

const heartbeatSchema = z.object({
  deviceId: z.string().trim().min(8).max(120),
  displayMode: z.enum(['browser', 'standalone', 'unknown']).default('unknown'),
  platform: z.enum(['web', 'ios', 'android', 'unknown']).default('unknown'),
  userAgent: z.string().max(500).optional().default(''),
  browserLanguage: z.string().max(50).optional().default(''),
});

router.post('/heartbeat', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const input = heartbeatSchema.parse(req.body);
    const now = new Date();

    const device = await UserDevice.findOneAndUpdate(
      { userId: req.userId, deviceId: input.deviceId },
      {
        $set: {
          displayMode: input.displayMode,
          platform: input.platform,
          userAgent: input.userAgent,
          browserLanguage: input.browserLanguage,
          lastSeenAt: now,
        },
        $setOnInsert: {
          userId: req.userId,
          deviceId: input.deviceId,
          firstSeenAt: now,
        },
      },
      { new: true, upsert: true }
    ).lean();

    res.json({
      device: {
        deviceId: device.deviceId,
        displayMode: device.displayMode,
        platform: device.platform,
        firstSeenAt: device.firstSeenAt.toISOString(),
        lastSeenAt: device.lastSeenAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid device heartbeat', details: error.errors });
      return;
    }
    throw error;
  }
});

export default router;

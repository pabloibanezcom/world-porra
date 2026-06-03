import { NextFunction, Response, Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ContactMessage } from '../models/ContactMessage';
import { User } from '../models/User';
import { logger } from '../config/logger';

const router = Router();

const createMessageSchema = z.object({
  subject: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(2000),
});

const listMessagesSchema = z.object({
  status: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.enum(['new', 'read', 'resolved']).optional()
  ),
});

const updateMessageSchema = z.object({
  status: z.enum(['new', 'read', 'resolved']),
});

const replySchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

async function requireMasterUser(req: AuthRequest, res: Response): Promise<boolean> {
  if (!req.userId) {
    res.status(401).json({ error: 'Missing authenticated user' });
    return false;
  }

  const user = await User.findById(req.userId).select('isMaster').lean();
  if (!user?.isMaster) {
    res.status(403).json({ error: 'Only master users can access contact messages' });
    return false;
  }

  return true;
}

async function isMasterUser(userId?: string): Promise<boolean> {
  if (!userId) return false;
  const user = await User.findById(userId).select('isMaster').lean();
  return !!user?.isMaster;
}

function serializeUser(user: any) {
  return user?._id
    ? {
        id: String(user._id),
        _id: String(user._id),
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl ?? '',
      }
    : null;
}

function serializeContactMessage(message: any) {
  const user = message.userId;
  return {
    _id: String(message._id),
    id: String(message._id),
    subject: message.subject,
    message: message.message,
    replies: (message.replies ?? []).map((reply: any) => ({
      _id: String(reply._id),
      id: String(reply._id),
      message: reply.message,
      createdAt: new Date(reply.createdAt).toISOString(),
      sender: serializeUser(reply.senderId),
    })),
    status: message.status,
    createdAt: new Date(message.createdAt).toISOString(),
    updatedAt: new Date(message.updatedAt).toISOString(),
    user: serializeUser(user),
  };
}

async function notifyMastersOfContactMessage(message: {
  _id: unknown;
  userId: unknown;
  subject: string;
}): Promise<void> {
  try {
    const masterUsers = await User.find({
      isMaster: true,
      _id: { $ne: message.userId },
    })
      .select('_id')
      .lean();

    if (masterUsers.length === 0) return;

    const { sendToUsers } = await import('../services/pushService.js');
    await sendToUsers(
      masterUsers.map((masterUser) => String(masterUser._id)),
      {
        title: 'New contact message',
        body: message.subject,
        url: '/',
      }
    );
  } catch (error) {
    logger.error({ err: error, messageId: String(message._id) }, 'Failed to notify master users about contact message');
  }
}

async function notifyUserOfMasterReply(message: { _id: unknown; userId: unknown; subject: string }): Promise<void> {
  try {
    const { sendToUsers } = await import('../services/pushService.js');
    await sendToUsers([String(message.userId)], {
      title: 'Master replied',
      body: message.subject,
      url: '/',
    });
  } catch (error) {
    logger.error({ err: error, messageId: String(message._id) }, 'Failed to notify user about master reply');
  }
}

router.post('/', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Missing authenticated user' });
      return;
    }

    const body = createMessageSchema.parse(req.body);
    const message = await ContactMessage.create({
      userId: req.userId,
      subject: body.subject,
      message: body.message,
    });

    await notifyMastersOfContactMessage(message);

    const populated = await ContactMessage.findById(message._id)
      .populate('userId', 'name email avatarUrl')
      .populate('replies.senderId', 'name email avatarUrl')
      .lean();
    res.status(201).json({ message: serializeContactMessage(populated) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid contact message', details: error.errors });
      return;
    }
    next(error);
  }
});

router.get('/', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Missing authenticated user' });
      return;
    }

    const messages = await ContactMessage.find({ userId: req.userId })
      .sort({ updatedAt: -1 })
      .limit(100)
      .populate('userId', 'name email avatarUrl')
      .populate('replies.senderId', 'name email avatarUrl')
      .lean();

    res.json({ messages: messages.map(serializeContactMessage) });
  } catch (error) {
    next(error);
  }
});

router.get('/admin', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await requireMasterUser(req, res))) return;

    const { status } = listMessagesSchema.parse(req.query);
    const query = status ? { status } : {};
    const messages = await ContactMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('userId', 'name email avatarUrl')
      .populate('replies.senderId', 'name email avatarUrl')
      .lean();

    res.json({ messages: messages.map(serializeContactMessage) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid contact message filter', details: error.errors });
      return;
    }
    next(error);
  }
});

router.patch('/admin/:messageId', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!(await requireMasterUser(req, res))) return;

    const { status } = updateMessageSchema.parse(req.body);
    const message = await ContactMessage.findByIdAndUpdate(
      req.params.messageId,
      { status },
      { new: true }
    )
      .populate('userId', 'name email avatarUrl')
      .populate('replies.senderId', 'name email avatarUrl')
      .lean();

    if (!message) {
      res.status(404).json({ error: 'Contact message not found' });
      return;
    }

    res.json({ message: serializeContactMessage(message) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid contact message update', details: error.errors });
      return;
    }
    next(error);
  }
});

router.post('/:messageId/replies', authMiddleware, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Missing authenticated user' });
      return;
    }

    const body = replySchema.parse(req.body);
    const message = await ContactMessage.findById(req.params.messageId);
    if (!message) {
      res.status(404).json({ error: 'Contact message not found' });
      return;
    }

    const senderIsMaster = await isMasterUser(req.userId);
    const senderOwnsThread = message.userId.toString() === req.userId;
    if (!senderIsMaster && !senderOwnsThread) {
      res.status(403).json({ error: 'You can only reply to your own contact messages' });
      return;
    }

    message.replies.push({
      senderId: new Types.ObjectId(req.userId),
      message: body.message,
      createdAt: new Date(),
    });
    message.status = senderIsMaster ? 'read' : 'new';
    await message.save();

    if (senderIsMaster) {
      await notifyUserOfMasterReply(message);
    } else {
      await notifyMastersOfContactMessage(message);
    }

    const populated = await ContactMessage.findById(message._id)
      .populate('userId', 'name email avatarUrl')
      .populate('replies.senderId', 'name email avatarUrl')
      .lean();

    res.status(201).json({ message: serializeContactMessage(populated) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid contact reply', details: error.errors });
      return;
    }
    next(error);
  }
});

export default router;

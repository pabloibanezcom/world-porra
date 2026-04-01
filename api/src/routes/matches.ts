import { Router, Request, Response } from 'express';
import { Match } from '../models/Match';
import { Prediction } from '../models/Prediction';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { stage, group, status } = req.query;

  const filter: Record<string, unknown> = {};
  if (stage) filter.stage = stage;
  if (group) filter.group = group;
  if (status) filter.status = status;

  const matches = await Match.find(filter).sort({ utcDate: 1 }).lean();
  res.json({ matches });
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const match = await Match.findById(req.params.id).lean();
  if (!match) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }

  const prediction = await Prediction.findOne({
    userId: req.userId,
    matchId: match._id,
  }).lean();

  res.json({ match, prediction: prediction || null });
});

export default router;

import { Router, Response } from 'express';
import { z } from 'zod';
import { Match } from '../models/Match';
import { Prediction } from '../models/Prediction';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { MatchWinner } from '../models/Match';

const router = Router();

const predictionSchema = z.object({
  matchId: z.string().min(1),
  homeGoals: z.number().int().min(0).max(15),
  awayGoals: z.number().int().min(0).max(15),
});

function deriveWinner(home: number, away: number): MatchWinner {
  if (home > away) return 'HOME';
  if (away > home) return 'AWAY';
  return 'DRAW';
}

router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { matchId, homeGoals, awayGoals } = predictionSchema.parse(req.body);

    const match = await Match.findById(matchId);
    if (!match) {
      res.status(404).json({ error: 'Match not found' });
      return;
    }

    if (new Date() >= match.utcDate) {
      res.status(400).json({ error: 'Match has already started. Predictions are locked.' });
      return;
    }

    const predictedWinner = deriveWinner(homeGoals, awayGoals);

    const prediction = await Prediction.findOneAndUpdate(
      { userId: req.userId, matchId },
      { homeGoals, awayGoals, predictedWinner, points: null },
      { upsert: true, new: true }
    );

    res.json({ prediction });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid prediction data', details: error.errors });
      return;
    }
    throw error;
  }
});

router.get('/mine', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { stage } = req.query;

  const predictions = await Prediction.find({ userId: req.userId })
    .populate('matchId')
    .sort({ createdAt: -1 })
    .lean();

  const filtered = stage
    ? predictions.filter((p) => (p.matchId as any)?.stage === stage)
    : predictions;

  res.json({ predictions: filtered });
});

router.get('/match/:matchId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const match = await Match.findById(req.params.matchId);
  if (!match) {
    res.status(404).json({ error: 'Match not found' });
    return;
  }

  // Only show others' predictions after kickoff
  if (new Date() < match.utcDate) {
    const own = await Prediction.findOne({ userId: req.userId, matchId: match._id }).lean();
    res.json({ predictions: own ? [own] : [] });
    return;
  }

  const { leagueId } = req.query;
  const filter: Record<string, unknown> = { matchId: match._id };

  if (leagueId) {
    const { League } = await import('../models/League');
    const league = await League.findById(leagueId);
    if (league) {
      const memberIds = league.members.map((m) => m.userId);
      filter.userId = { $in: memberIds };
    }
  }

  const predictions = await Prediction.find(filter).populate('userId', 'name avatarUrl').lean();
  res.json({ predictions });
});

export default router;

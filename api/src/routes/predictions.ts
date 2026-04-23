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

function serializePrediction<T extends { _id: unknown; userId: unknown; matchId: unknown }>(prediction: T) {
  return {
    ...prediction,
    _id: String(prediction._id),
    userId: String(prediction.userId),
    matchId: String(prediction.matchId),
  };
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

  const filter: Record<string, unknown> = { userId: req.userId };

  if (typeof stage === 'string' && stage) {
    const stageMatches = await Match.find({ stage }).select('_id').lean();
    filter.matchId = { $in: stageMatches.map((match) => match._id) };
  }

  const predictions = await Prediction.find(filter)
    .sort({ createdAt: -1 })
    .lean();

  res.json({ predictions: predictions.map(serializePrediction) });
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

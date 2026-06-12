import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { jokerInputSchema } from '../shared';
import { getRequestLanguage } from '../services/countryTeamService';
import {
  getMatchPredictionsForViewer,
  getMyGroupPredictions,
  getMyPredictions,
  getTournamentPrediction,
  groupPredictionSchema,
  predictionSchema,
  PredictionServiceError,
  saveGroupPrediction,
  saveMatchPrediction,
  saveTournamentPrediction,
  setMatchJoker,
  tournamentPredictionSchema,
} from '../services/predictionService';

const router = Router();

function isZodError(error: unknown): error is z.ZodError {
  return error instanceof z.ZodError || (
    typeof error === 'object' &&
    error !== null &&
    Array.isArray((error as z.ZodError).errors)
  );
}

function handleRouteError(
  error: unknown,
  res: Response,
  options: { invalidMessage?: string; zodErrorAsDetails?: boolean } = {}
): boolean {
  if (isZodError(error)) {
    if (options.zodErrorAsDetails === false) {
      res.status(400).json({ error: error.errors });
      return true;
    }

    res.status(400).json({ error: options.invalidMessage ?? 'Invalid prediction data', details: error.errors });
    return true;
  }

  if (error instanceof PredictionServiceError) {
    res.status(error.statusCode).json({ error: error.message });
    return true;
  }

  return false;
}

router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const input = predictionSchema.parse(req.body);
    const prediction = await saveMatchPrediction(req.userId!, input);
    res.json({ prediction });
  } catch (error) {
    if (handleRouteError(error, res, { invalidMessage: 'Invalid prediction data' })) return;
    throw error;
  }
});

router.post('/joker', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { matchId, active } = jokerInputSchema.parse(req.body);
    const prediction = await setMatchJoker(req.userId!, matchId, active);
    res.json({ prediction });
  } catch (error) {
    if (handleRouteError(error, res, { invalidMessage: 'Invalid joker data' })) return;
    throw error;
  }
});

router.get('/groups/mine', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const predictions = await getMyGroupPredictions(req.userId!, getRequestLanguage(req));
  res.json({ predictions });
});

router.post('/groups', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const input = groupPredictionSchema.parse(req.body);
    const prediction = await saveGroupPrediction(req.userId!, input, getRequestLanguage(req));
    res.json({ prediction });
  } catch (error) {
    if (handleRouteError(error, res, { invalidMessage: 'Invalid group prediction data' })) return;
    throw error;
  }
});

router.get('/mine', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const stage = typeof req.query.stage === 'string' ? req.query.stage : undefined;
  const predictions = await getMyPredictions(req.userId!, stage);
  res.json({ predictions });
});

router.get('/match/:matchId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const leagueId = typeof req.query.leagueId === 'string' ? req.query.leagueId : undefined;
    const matchId = String(req.params.matchId);
    const predictions = await getMatchPredictionsForViewer(req.userId!, matchId, leagueId);
    res.json({ predictions });
  } catch (error) {
    if (handleRouteError(error, res)) return;
    throw error;
  }
});

router.get('/tournament', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const prediction = await getTournamentPrediction(req.userId!, getRequestLanguage(req));
  res.json({ prediction });
});

router.post('/tournament', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const input = tournamentPredictionSchema.parse(req.body);
    const prediction = await saveTournamentPrediction(req.userId!, input, getRequestLanguage(req));
    res.json({ prediction });
  } catch (error) {
    if (handleRouteError(error, res, { zodErrorAsDetails: false })) return;
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

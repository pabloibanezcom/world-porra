import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { getRequestLanguage, getTournamentCatalog } from '../services/countryTeamService';
import { getPollConfig, serializePollConfig, updatePollConfig } from '../services/pollConfigService';

const router = Router();

const nullableDateSchema = z.preprocess((value) => {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return value;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date;
}, z.date().nullable());

const updatePollConfigSchema = z.object({
  groupPredictionsDeadline: nullableDateSchema.optional(),
  tournamentPredictionsDeadline: nullableDateSchema.optional(),
});

async function requireMaster(req: AuthRequest, res: Response): Promise<boolean> {
  const user = await User.findById(req.userId).select('isMaster').lean();
  if (!user?.isMaster) {
    res.status(403).json({ error: 'Only master users can update poll configuration' });
    return false;
  }

  return true;
}

router.get('/poll', authMiddleware, async (_req: AuthRequest, res: Response): Promise<void> => {
  const config = await getPollConfig();
  res.json({ config: serializePollConfig(config) });
});

router.get('/tournament-catalog', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const teams = await getTournamentCatalog(getRequestLanguage(req));
  res.json({ teams });
});

router.patch('/poll', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!await requireMaster(req, res)) return;

    const update = updatePollConfigSchema.parse(req.body ?? {});
    const config = await updatePollConfig(update);
    res.json({ config: serializePollConfig(config) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid poll configuration data', details: error.errors });
      return;
    }

    throw error;
  }
});

export default router;

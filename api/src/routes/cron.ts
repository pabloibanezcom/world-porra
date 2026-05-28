import { Router, Request, Response } from 'express';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { syncOdds } from '../services/oddsService';

const router = Router();

function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.authorization;
  if (env.CRON_SECRET && authHeader === `Bearer ${env.CRON_SECRET}`) return true;

  const syncKey = req.header('x-sync-api-key');
  return Boolean(env.SYNC_API_KEY && syncKey === env.SYNC_API_KEY);
}

router.get('/daily-odds', async (req: Request, res: Response): Promise<void> => {
  if (!env.CRON_SECRET && !env.SYNC_API_KEY) {
    logger.warn('Daily odds cron rejected: no cron secret or sync key configured');
    res.status(503).json({ error: 'CRON_SECRET or SYNC_API_KEY must be configured' });
    return;
  }

  if (!isAuthorized(req)) {
    logger.warn('Daily odds cron rejected: unauthorized request');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    logger.info('Daily odds cron started');
    const oddsResult = await syncOdds();
    logger.info(oddsResult, 'Daily odds cron complete');
    res.json({
      ok: true,
      oddsMatchesUpdated: oddsResult.matchesUpdated,
      oddsRequestsRemaining: oddsResult.requestsRemaining,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, 'Daily odds cron failed');
    res.status(500).json({ error: 'Daily odds cron failed' });
  }
});

export default router;

import { Request } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

type CronAuthEnv = Pick<typeof env, 'CRON_SECRET' | 'SYNC_API_KEY'>;

export function isAuthorizedCronRequest(req: Request, config: CronAuthEnv = env): boolean {
  if (!req.path.startsWith('/cron/')) return false;

  const authHeader = req.headers.authorization;
  if (config.CRON_SECRET && authHeader === `Bearer ${config.CRON_SECRET}`) return true;

  const syncKey = req.header('x-sync-api-key');
  return Boolean(config.SYNC_API_KEY && syncKey === config.SYNC_API_KEY);
}

export const publicApiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isAuthorizedCronRequest(req),
});

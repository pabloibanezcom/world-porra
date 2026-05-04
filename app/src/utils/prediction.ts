import { Match } from '../types';

const LOCK_MINUTES_BEFORE = 5;

export function isPredictionLocked(match: Match): boolean {
  if (match.status === 'FINISHED' || match.status === 'LIVE') return true;
  const lockTime = new Date(match.utcDate).getTime() - LOCK_MINUTES_BEFORE * 60 * 1000;
  return Date.now() >= lockTime;
}

import { Match } from '../types';

const LOCK_MINUTES_BEFORE = 5;

export function getPredictionLockTime(match: Match): Date {
  return new Date(new Date(match.utcDate).getTime() - LOCK_MINUTES_BEFORE * 60 * 1000);
}

export function isPredictionLocked(match: Match): boolean {
  if (match.status === 'FINISHED' || match.status === 'LIVE') return true;
  return Date.now() >= getPredictionLockTime(match).getTime();
}

import { League } from '../types';

export const KNOCKOUT_TOURNAMENT_PICKS_DEADLINE = new Date('2026-06-30T23:59:59.999Z');

function getLeagueScoringScope(league: League) {
  return league.scoringScope ?? 'FULL_TOURNAMENT';
}

export function hasOnlyKnockoutOnlyLeagues(leagues: League[]): boolean {
  return leagues.length > 0 && leagues.every((league) => getLeagueScoringScope(league) === 'KNOCKOUT_ONLY');
}

export function canEditTournamentPicksAfterGlobalLock(
  leagues: League[],
  now: Date,
): boolean {
  if (!hasOnlyKnockoutOnlyLeagues(leagues)) return false;

  return now <= KNOCKOUT_TOURNAMENT_PICKS_DEADLINE;
}

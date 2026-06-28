import { describe, expect, it } from 'vitest';
import { League } from '../types';
import {
  canEditTournamentPicksAfterGlobalLock,
  hasOnlyKnockoutOnlyLeagues,
  KNOCKOUT_TOURNAMENT_PICKS_DEADLINE,
} from './tournamentPicks';

function league(scoringScope?: League['scoringScope']): League {
  return { _id: 'league-id', scoringScope } as League;
}

describe('tournament pick lock helpers', () => {
  it('requires exclusively knockout-only league membership for late tournament picks', () => {
    expect(hasOnlyKnockoutOnlyLeagues([league('KNOCKOUT_ONLY')])).toBe(true);
    expect(hasOnlyKnockoutOnlyLeagues([league('KNOCKOUT_ONLY'), league('FULL_TOURNAMENT')])).toBe(false);
    expect(hasOnlyKnockoutOnlyLeagues([league()])).toBe(false);
    expect(hasOnlyKnockoutOnlyLeagues([])).toBe(false);
  });

  it('uses June 30 as the late tournament pick deadline', () => {
    expect(KNOCKOUT_TOURNAMENT_PICKS_DEADLINE.toISOString()).toBe('2026-06-30T23:59:59.999Z');
    expect(canEditTournamentPicksAfterGlobalLock([league('KNOCKOUT_ONLY')], new Date('2026-06-30T23:59:59.999Z'))).toBe(true);
    expect(canEditTournamentPicksAfterGlobalLock([league('KNOCKOUT_ONLY')], new Date('2026-07-01T00:00:00.000Z'))).toBe(false);
    expect(canEditTournamentPicksAfterGlobalLock([league('FULL_TOURNAMENT')], new Date('2026-06-30T23:59:59.999Z'))).toBe(false);
  });
});

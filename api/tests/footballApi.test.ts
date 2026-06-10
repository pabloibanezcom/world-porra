import { describe, expect, it } from 'vitest';
import { mapExternalMatch } from '../src/services/footballApi';

describe('mapExternalMatch', () => {
  it('canonicalizes football-data team codes to app team codes', () => {
    const match = mapExternalMatch({
      id: 123,
      stage: 'GROUP_STAGE',
      group: 'GROUP_A',
      matchday: 1,
      homeTeam: { name: 'Uruguay', tla: 'URY', crest: 'uru.svg' },
      awayTeam: { name: 'Curaçao', tla: 'CUR', crest: 'cuw.svg' },
      utcDate: '2026-06-11T19:00:00.000Z',
      status: 'TIMED',
      score: {
        fullTime: { home: null, away: null },
        winner: null,
      },
    });

    expect(match.homeTeamCode).toBe('URU');
    expect(match.awayTeamCode).toBe('CUW');
    expect(match.sourceTeams.home.code).toBe('URU');
    expect(match.sourceTeams.away.code).toBe('CUW');
  });
});

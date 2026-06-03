import { describe, expect, it } from 'vitest';
import { calculateAgeOnDate, mapFifaSquadPlayer } from '../src/services/fifaSquadService';

describe('fifaSquadService', () => {
  it('calculates player age on the tournament kickoff date', () => {
    expect(calculateAgeOnDate('2004-06-11T00:00:00Z')).toBe(22);
    expect(calculateAgeOnDate('2004-06-12T00:00:00Z')).toBe(21);
  });

  it('maps FIFA squad players into the local player catalog shape', () => {
    const player = mapFifaSquadPlayer({
      PlayerName: [{ Locale: 'en-GB', Description: 'Lamine YAMAL' }],
      ShortName: [{ Locale: 'en-GB', Description: 'LAMINE YAMAL' }],
      JerseyNum: 19,
      Position: 3,
      BirthDate: '2007-07-13T00:00:00Z',
    });

    expect(player).toEqual({ name: 'Lamine Yamal', pos: 'FW', age: 18, shirtNumber: 19 });
  });
});

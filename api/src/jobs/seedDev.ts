import { Match } from '../models/Match';
import { logger } from '../config/logger';
import { upsertCountryTeamFromSource } from '../services/countryTeamService';

const teams = [
  { name: 'United States', code: 'USA', crest: '', players: [{ name: 'Christian Pulisic', pos: 'FW' as const, age: 27 }] },
  { name: 'Mexico', code: 'MEX', crest: '', players: [{ name: 'Santiago Gimenez', pos: 'FW' as const, age: 25 }] },
  { name: 'Canada', code: 'CAN', crest: '', players: [{ name: 'Alphonso Davies', pos: 'DF' as const, age: 25 }] },
  { name: 'Brazil', code: 'BRA', crest: '', players: [{ name: 'Endrick', pos: 'FW' as const, age: 19 }] },
  { name: 'Argentina', code: 'ARG', crest: '', players: [{ name: 'Lionel Messi', pos: 'FW' as const, age: 38 }] },
  { name: 'France', code: 'FRA', crest: '', players: [{ name: 'Kylian Mbappe', pos: 'FW' as const, age: 27 }] },
  { name: 'Germany', code: 'GER', crest: '', players: [{ name: 'Florian Wirtz', pos: 'MF' as const, age: 23 }] },
  { name: 'Spain', code: 'ESP', crest: '', players: [{ name: 'Lamine Yamal', pos: 'FW' as const, age: 18 }] },
  { name: 'England', code: 'ENG', crest: '', players: [{ name: 'Jude Bellingham', pos: 'MF' as const, age: 22 }] },
  { name: 'Portugal', code: 'POR', crest: '', players: [{ name: 'Cristiano Ronaldo', pos: 'FW' as const, age: 41 }] },
  { name: 'Japan', code: 'JPN', crest: '', players: [{ name: 'Takefusa Kubo', pos: 'MF' as const, age: 25 }] },
  { name: 'South Korea', code: 'KOR', crest: '', players: [{ name: 'Son Heung-min', pos: 'FW' as const, age: 33 }] },
];

const groups = ['A', 'B', 'C', 'D'];

export async function seedDevMatches(): Promise<void> {
  await Promise.all(teams.map((team) => upsertCountryTeamFromSource(team)));
  const count = await Match.countDocuments();
  if (count > 0) return;

  const matches = [];
  let externalId = 9001;
  const baseDate = new Date('2026-06-11T18:00:00Z');

  // 2 matches per group, 3 matchdays = 24 matches
  for (let g = 0; g < groups.length; g++) {
    const groupTeams = teams.slice(g * 3, g * 3 + 3);
    // Add a 4th team by wrapping
    groupTeams.push(teams[(g * 3 + 3) % teams.length]);

    const pairings = [
      [0, 1, 1],
      [2, 3, 1],
      [0, 2, 2],
      [1, 3, 2],
      [0, 3, 3],
      [1, 2, 3],
    ];

    for (const [h, a, md] of pairings) {
      const dayOffset = (md - 1) * 3 + g;
      const utcDate = new Date(baseDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);

      // Make first matchday "finished" so there's something to see
      const isFinished = md === 1;
      const homeGoals = isFinished ? Math.floor(Math.random() * 4) : 0;
      const awayGoals = isFinished ? Math.floor(Math.random() * 3) : 0;

      matches.push({
        externalId: externalId++,
        stage: 'GROUP' as const,
        group: groups[g],
        matchday: md,
        homeTeamCode: groupTeams[h].code,
        awayTeamCode: groupTeams[a].code,
        utcDate,
        status: isFinished ? 'FINISHED' as const : 'SCHEDULED' as const,
        result: isFinished
          ? {
              homeGoals,
              awayGoals,
              winner: homeGoals > awayGoals ? 'HOME' as const : awayGoals > homeGoals ? 'AWAY' as const : 'DRAW' as const,
            }
          : null,
        scoresProcessed: false,
      });
    }
  }

  await Match.insertMany(matches);
  logger.info(`Seeded ${matches.length} dev matches`);
}

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, requestJson, startIntegrationServer, stopIntegrationServer } from './helpers/integration';
import { seedCountryTeams } from '../src/services/countryTeamService';
import { Match } from '../src/models/Match';
import { Prediction } from '../src/models/Prediction';
import { GroupPrediction } from '../src/models/GroupPrediction';

beforeAll(async () => {
  await startIntegrationServer();
});

beforeEach(async () => {
  await clearDatabase();
  await seedCountryTeams();
});

afterAll(async () => {
  await stopIntegrationServer();
});

async function registerPlayer(email = 'player@wc2026.test') {
  const response = await requestJson<{ token: string; user: { id: string } }>('/auth/register', {
    body: { email, name: 'Player', password: 'valid-password' },
  });
  expect(response.status).toBe(201);
  return response.body;
}

async function createMatch(overrides: Partial<Parameters<typeof Match.create>[0]> = {}) {
  return Match.create({
    externalId: Math.floor(Math.random() * 1_000_000),
    stage: 'GROUP',
    group: 'A',
    matchday: 1,
    homeTeamCode: 'ARG',
    awayTeamCode: 'ESP',
    utcDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: 'SCHEDULED',
    ...overrides,
  });
}

describe('prediction read routes', () => {
  it('returns the current user predictions and can filter them by match stage', async () => {
    const { token, user } = await registerPlayer();
    const groupMatch = await createMatch({ externalId: 401, stage: 'GROUP' });
    const finalMatch = await createMatch({ externalId: 402, stage: 'FINAL', group: null });
    await Prediction.create([
      { userId: user.id, matchId: groupMatch._id, homeGoals: 1, awayGoals: 0, predictedWinner: 'HOME' },
      { userId: user.id, matchId: finalMatch._id, homeGoals: 2, awayGoals: 2, predictedWinner: 'DRAW' },
    ]);

    const all = await requestJson<{ predictions: Array<{ matchId: string }> }>('/predictions/mine', { token });
    expect(all.status).toBe(200);
    expect(all.body.predictions).toHaveLength(2);

    const finals = await requestJson<{ predictions: Array<{ matchId: string }> }>('/predictions/mine?stage=FINAL', { token });
    expect(finals.status).toBe(200);
    expect(finals.body.predictions).toHaveLength(1);
    expect(finals.body.predictions[0].matchId).toBe(String(finalMatch._id));
  });

  it('returns localized group predictions for the current user', async () => {
    const { token, user } = await registerPlayer();
    await GroupPrediction.create({
      userId: user.id,
      group: 'A',
      orderedTeamCodes: ['ARG', 'ESP'],
    });

    const response = await requestJson<{ predictions: Array<{ orderedTeamCodes: string[]; orderedTeams: Array<{ name: string }> }> }>(
      '/predictions/groups/mine?lang=es',
      { token }
    );

    expect(response.status).toBe(200);
    expect(response.body.predictions).toHaveLength(1);
    expect(response.body.predictions[0].orderedTeamCodes).toEqual(['ARG', 'ESP']);
    expect(response.body.predictions[0].orderedTeams.map((team) => team.name)).toEqual(['Argentina', 'Espa\u00f1a']);
  });
});

describe('tournament predictions', () => {
  it('creates, updates, and localizes tournament picks', async () => {
    const { token } = await registerPlayer();

    const create = await requestJson<{ prediction: { championCode: string; runnerUpCode: string; champion: { name: string }; bestPlayer: { name: string } } }>(
      '/predictions/tournament?lang=es',
      {
        token,
        body: {
          champion: { code: 'arg' },
          runnerUp: { code: 'esp' },
          semi1: { code: 'bra' },
          semi2: { code: 'fra' },
          bestPlayer: { name: 'Lionel Messi', team: 'Argentina', code: 'ARG', pos: 'FW' },
        },
      }
    );

    expect(create.status).toBe(200);
    expect(create.body.prediction).toMatchObject({
      championCode: 'ARG',
      runnerUpCode: 'ESP',
      champion: { name: 'Argentina' },
      bestPlayer: { name: 'Lionel Messi' },
    });

    const read = await requestJson<{ prediction: { runnerUp: { name: string } } }>('/predictions/tournament?lang=es', {
      token,
    });
    expect(read.status).toBe(200);
    expect(read.body.prediction.runnerUp.name).toBe('Espa\u00f1a');
  });

  it('returns null when the current user has no tournament prediction and rejects invalid payloads', async () => {
    const { token } = await registerPlayer();

    const empty = await requestJson<{ prediction: null }>('/predictions/tournament', { token });
    expect(empty.status).toBe(200);
    expect(empty.body.prediction).toBeNull();

    const invalid = await requestJson('/predictions/tournament', {
      token,
      body: { bestPlayer: { name: '', team: 'Argentina', code: 'ARG', pos: 'FW' } },
    });
    expect(invalid.status).toBe(400);
  });
});

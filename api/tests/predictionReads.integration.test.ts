import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, requestJson, seedTestCountryTeams, startIntegrationServer, stopIntegrationServer } from './helpers/integration';
import { Match } from '../src/models/Match';
import { Prediction } from '../src/models/Prediction';
import { GroupPrediction } from '../src/models/GroupPrediction';

beforeAll(async () => {
  await startIntegrationServer();
});

beforeEach(async () => {
  await clearDatabase();
  await seedTestCountryTeams();
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
  it('returns tournament catalog teams and embedded players from participating match teams', async () => {
    const { token } = await registerPlayer();
    await createMatch({ externalId: 301, homeTeamCode: 'ARG', awayTeamCode: 'ESP' });

    const response = await requestJson<{
      teams: Array<{ code: string; name: string; players: Array<{ name: string; pos: string; age: number }> }>;
    }>('/config/tournament-catalog?lang=es', { token });

    expect(response.status).toBe(200);
    expect(response.body.teams.map((team) => team.code).sort()).toEqual(['ARG', 'ESP']);
    expect(response.body.teams.find((team) => team.code === 'ESP')).toMatchObject({
      name: 'Espa\u00f1a',
      players: [{ name: 'Lamine Yamal', pos: 'FW', age: 18 }],
    });
  });

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

  it('returns projected group standing points from current results', async () => {
    const { token, user } = await registerPlayer();
    await Match.create([
      {
        externalId: 501,
        stage: 'GROUP',
        group: 'B',
        matchday: 1,
        homeTeamCode: 'ARG',
        awayTeamCode: 'ESP',
        utcDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        status: 'FINISHED',
        result: { homeGoals: 2, awayGoals: 0, winner: 'HOME' },
      },
      {
        externalId: 502,
        stage: 'GROUP',
        group: 'B',
        matchday: 1,
        homeTeamCode: 'BRA',
        awayTeamCode: 'FRA',
        utcDate: new Date(Date.now() - 23 * 60 * 60 * 1000),
        status: 'FINISHED',
        result: { homeGoals: 1, awayGoals: 1, winner: 'DRAW' },
      },
    ]);
    await GroupPrediction.create({
      userId: user.id,
      group: 'B',
      orderedTeamCodes: ['ARG', 'BRA', 'FRA', 'ESP'],
    });

    const response = await requestJson<{
      predictions: Array<{
        progress: {
          projectedPoints: number;
          perfectBonus: number;
          currentOrderCodes: string[];
          teams: Array<{ code: string; currentPosition: number; points: number; status: string }>;
        };
      }>;
    }>('/predictions/groups/mine', { token });

    expect(response.status).toBe(200);
    expect(response.body.predictions[0].progress).toMatchObject({
      projectedPoints: 25,
      perfectBonus: 5,
      currentOrderCodes: ['ARG', 'BRA', 'FRA', 'ESP'],
    });
    expect(response.body.predictions[0].progress.teams.map((team) => ({
      code: team.code,
      currentPosition: team.currentPosition,
      points: team.points,
      status: team.status,
    }))).toEqual([
      { code: 'ARG', currentPosition: 1, points: 8, status: 'exact' },
      { code: 'BRA', currentPosition: 2, points: 6, status: 'exact' },
      { code: 'FRA', currentPosition: 3, points: 3, status: 'exact' },
      { code: 'ESP', currentPosition: 4, points: 3, status: 'exact' },
    ]);
  });
});

describe('tournament predictions', () => {
  it('creates, updates, and localizes tournament picks', async () => {
    const { token } = await registerPlayer();
    await createMatch({ externalId: 801, homeTeamCode: 'ARG', awayTeamCode: 'ESP' });
    await createMatch({ externalId: 802, homeTeamCode: 'BRA', awayTeamCode: 'FRA' });

    const create = await requestJson<{ prediction: { championCode: string; runnerUpCode: string; champion: { name: string }; bestPlayer: { name: string } } }>(
      '/predictions/tournament?lang=es',
      {
        token,
        body: {
          champion: { code: 'arg' },
          runnerUp: { code: 'esp' },
          semi1: { code: 'bra' },
          semi2: { code: 'fra' },
          bestPlayer: { name: 'Lionel Messi', team: 'Argentina', code: 'ARG', pos: 'FW', age: 38 },
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
      body: { bestPlayer: { name: '', team: 'Argentina', code: 'ARG', pos: 'FW', age: 38 } },
    });
    expect(invalid.status).toBe(400);
  });

  it('rejects tournament picks that are not in the team and player catalog', async () => {
    const { token } = await registerPlayer();
    await createMatch({ externalId: 901, homeTeamCode: 'ARG', awayTeamCode: 'ESP' });

    const unknownTeam = await requestJson('/predictions/tournament', {
      token,
      body: { champion: { code: 'BOL' } },
    });
    expect(unknownTeam.status).toBe(400);
    expect(unknownTeam.body).toEqual({ error: 'Unknown tournament team "BOL"' });

    const unknownPlayer = await requestJson('/predictions/tournament', {
      token,
      body: { bestPlayer: { name: 'Not In DB', team: 'Argentina', code: 'ARG', pos: 'FW', age: 30 } },
    });
    expect(unknownPlayer.status).toBe(400);
    expect(unknownPlayer.body).toEqual({ error: 'Unknown tournament player "Not In DB"' });

    const tooOld = await requestJson('/predictions/tournament', {
      token,
      body: { bestYoung: { name: 'Lionel Messi', team: 'Argentina', code: 'ARG', pos: 'FW', age: 38 } },
    });
    expect(tooOld.status).toBe(400);
    expect(tooOld.body).toEqual({ error: 'Best young player must be 21 or younger' });

    const duplicateTeam = await requestJson('/predictions/tournament', {
      token,
      body: { champion: { code: 'ARG' }, runnerUp: { code: 'ARG' } },
    });
    expect(duplicateTeam.status).toBe(400);
    expect(duplicateTeam.body).toEqual({ error: 'Tournament final four picks must be unique (ARG)' });
  });
});

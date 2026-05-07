import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, requestJson, seedTestCountryTeams, startIntegrationServer, stopIntegrationServer } from './helpers/integration';
import { Match } from '../src/models/Match';
import { Prediction } from '../src/models/Prediction';

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

describe('match routes', () => {
  it('requires authentication and returns localized, filtered matches', async () => {
    const unauthorized = await requestJson('/matches');
    expect(unauthorized.status).toBe(401);

    const { token } = await registerPlayer();
    await Promise.all([
      createMatch({ externalId: 101, group: 'A', homeTeamCode: 'ARG', awayTeamCode: 'ESP' }),
      createMatch({ externalId: 102, group: 'B', homeTeamCode: 'BRA', awayTeamCode: 'FRA' }),
    ]);

    const response = await requestJson<{ matches: Array<{ group: string; homeTeam: { name: string }; awayTeam: { name: string } }> }>(
      '/matches?stage=GROUP&group=A&lang=es',
      { token }
    );

    expect(response.status).toBe(200);
    expect(response.body.matches).toHaveLength(1);
    expect(response.body.matches[0]).toMatchObject({
      group: 'A',
      homeTeam: { name: 'Argentina' },
      awayTeam: { name: 'Espa\u00f1a' },
    });
  });

  it('returns a match with the requesting user prediction', async () => {
    const { token, user } = await registerPlayer();
    const match = await createMatch();
    await Prediction.create({
      userId: user.id,
      matchId: match._id,
      homeGoals: 2,
      awayGoals: 1,
      predictedWinner: 'HOME',
    });

    const response = await requestJson<{ prediction: { homeGoals: number; awayGoals: number } }>(
      `/matches/${match._id}`,
      { token }
    );

    expect(response.status).toBe(200);
    expect(response.body.prediction).toMatchObject({ homeGoals: 2, awayGoals: 1 });
  });
});

describe('match predictions', () => {
  it('creates and updates a prediction before kickoff', async () => {
    const { token } = await registerPlayer();
    const match = await createMatch();

    const create = await requestJson<{ prediction: { homeGoals: number; awayGoals: number; predictedWinner: string; points: null } }>(
      '/predictions',
      {
        token,
        body: { matchId: String(match._id), homeGoals: 3, awayGoals: 1 },
      }
    );
    expect(create.status).toBe(200);
    expect(create.body.prediction).toMatchObject({
      homeGoals: 3,
      awayGoals: 1,
      predictedWinner: 'HOME',
      points: null,
    });

    const update = await requestJson<{ prediction: { homeGoals: number; awayGoals: number; predictedWinner: string } }>(
      '/predictions',
      {
        token,
        body: { matchId: String(match._id), homeGoals: 1, awayGoals: 2 },
      }
    );
    expect(update.status).toBe(200);
    expect(update.body.prediction).toMatchObject({
      homeGoals: 1,
      awayGoals: 2,
      predictedWinner: 'AWAY',
    });

    const stored = await Prediction.find({ matchId: match._id }).lean();
    expect(stored).toHaveLength(1);
  });

  it('rejects invalid, missing, unconfirmed, and locked matches', async () => {
    const { token } = await registerPlayer();
    const futureTbd = await createMatch({ homeTeamCode: 'TBD', awayTeamCode: 'ESP' });
    const started = await createMatch({
      externalId: 999,
      utcDate: new Date(Date.now() - 60 * 1000),
    });
    const live = await createMatch({
      externalId: 1000,
      status: 'LIVE',
      utcDate: new Date(Date.now() + 60 * 60 * 1000),
    });

    const invalidPayload = await requestJson('/predictions', {
      token,
      body: { matchId: String(started._id), homeGoals: 16, awayGoals: 0 },
    });
    expect(invalidPayload.status).toBe(400);
    expect(invalidPayload.body).toMatchObject({ error: 'Invalid prediction data' });

    const missingMatch = await requestJson('/predictions', {
      token,
      body: { matchId: '507f1f77bcf86cd799439011', homeGoals: 1, awayGoals: 1 },
    });
    expect(missingMatch.status).toBe(404);
    expect(missingMatch.body).toEqual({ error: 'Match not found' });

    const unconfirmed = await requestJson('/predictions', {
      token,
      body: { matchId: String(futureTbd._id), homeGoals: 1, awayGoals: 1 },
    });
    expect(unconfirmed.status).toBe(400);
    expect(unconfirmed.body).toEqual({ error: 'Predictions are not available until both teams are confirmed.' });

    const locked = await requestJson('/predictions', {
      token,
      body: { matchId: String(started._id), homeGoals: 1, awayGoals: 1 },
    });
    expect(locked.status).toBe(400);
    expect(locked.body).toEqual({ error: 'Predictions are locked 5 minutes before kickoff.' });

    const liveLocked = await requestJson('/predictions', {
      token,
      body: { matchId: String(live._id), homeGoals: 1, awayGoals: 1 },
    });
    expect(liveLocked.status).toBe(400);
    expect(liveLocked.body).toEqual({ error: 'Predictions are locked for this match.' });
  });

  it('only reveals other users predictions after kickoff', async () => {
    const playerA = await registerPlayer('player-a@wc2026.test');
    const playerB = await registerPlayer('player-b@wc2026.test');
    const upcoming = await createMatch();
    const started = await createMatch({
      externalId: 456,
      utcDate: new Date(Date.now() - 60 * 1000),
    });

    await Prediction.create([
      { userId: playerA.user.id, matchId: upcoming._id, homeGoals: 1, awayGoals: 0, predictedWinner: 'HOME' },
      { userId: playerB.user.id, matchId: upcoming._id, homeGoals: 0, awayGoals: 1, predictedWinner: 'AWAY' },
      { userId: playerA.user.id, matchId: started._id, homeGoals: 2, awayGoals: 2, predictedWinner: 'DRAW' },
      { userId: playerB.user.id, matchId: started._id, homeGoals: 3, awayGoals: 2, predictedWinner: 'HOME' },
    ]);

    const beforeKickoff = await requestJson<{ predictions: unknown[] }>(`/predictions/match/${upcoming._id}`, {
      token: playerA.token,
    });
    expect(beforeKickoff.status).toBe(200);
    expect(beforeKickoff.body.predictions).toHaveLength(1);

    const afterKickoff = await requestJson<{ predictions: unknown[] }>(`/predictions/match/${started._id}`, {
      token: playerA.token,
    });
    expect(afterKickoff.status).toBe(200);
    expect(afterKickoff.body.predictions).toHaveLength(2);
  });
});

describe('knockout predictions', () => {
  it('saves a knockout prediction with a qualifier', async () => {
    const { token } = await registerPlayer();
    const match = await createMatch({ stage: 'ROUND_OF_16', group: null });

    const response = await requestJson<{ prediction: { homeGoals: number; awayGoals: number; qualifier: string } }>(
      '/predictions',
      { token, body: { matchId: String(match._id), homeGoals: 2, awayGoals: 1, qualifier: 'HOME' } }
    );

    expect(response.status).toBe(200);
    expect(response.body.prediction).toMatchObject({ homeGoals: 2, awayGoals: 1, qualifier: 'HOME' });
  });

  it('saves a draw knockout prediction with an explicit qualifier', async () => {
    const { token } = await registerPlayer();
    const match = await createMatch({ stage: 'QUARTER_FINAL', group: null });

    const response = await requestJson<{ prediction: { homeGoals: number; qualifier: string } }>(
      '/predictions',
      { token, body: { matchId: String(match._id), homeGoals: 1, awayGoals: 1, qualifier: 'AWAY' } }
    );

    expect(response.status).toBe(200);
    expect(response.body.prediction).toMatchObject({ homeGoals: 1, awayGoals: 1, qualifier: 'AWAY' });
  });

  it('rejects knockout prediction without qualifier', async () => {
    const { token } = await registerPlayer();
    const match = await createMatch({ stage: 'SEMI_FINAL', group: null });

    const response = await requestJson('/predictions', {
      token,
      body: { matchId: String(match._id), homeGoals: 1, awayGoals: 0 },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Knockout predictions require a qualifier (HOME or AWAY).' });
  });

  it('rejects qualifier inconsistent with predicted score', async () => {
    const { token } = await registerPlayer();
    const match = await createMatch({ stage: 'ROUND_OF_32', group: null });

    // Score says HOME wins (2-0) but qualifier picks AWAY
    const response = await requestJson('/predictions', {
      token,
      body: { matchId: String(match._id), homeGoals: 2, awayGoals: 0, qualifier: 'AWAY' },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Qualifier must match the predicted winner when the score is not a draw.' });
  });

  it('rejects qualifier inconsistent with away-wins score', async () => {
    const { token } = await registerPlayer();
    const match = await createMatch({ stage: 'FINAL', group: null });

    // Score says AWAY wins (0-2) but qualifier picks HOME
    const response = await requestJson('/predictions', {
      token,
      body: { matchId: String(match._id), homeGoals: 0, awayGoals: 2, qualifier: 'HOME' },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Qualifier must match the predicted winner when the score is not a draw.' });
  });

  it('group stage predictions do not require qualifier', async () => {
    const { token } = await registerPlayer();
    const match = await createMatch({ stage: 'GROUP', group: 'A' });

    const response = await requestJson<{ prediction: { qualifier: unknown } }>(
      '/predictions',
      { token, body: { matchId: String(match._id), homeGoals: 1, awayGoals: 0 } }
    );

    expect(response.status).toBe(200);
    expect(response.body.prediction.qualifier).toBeNull();
  });
});

describe('group predictions', () => {
  it('creates a normalized group prediction for all confirmed group teams', async () => {
    const { token } = await registerPlayer();
    await Promise.all([
      createMatch({ externalId: 201, group: 'C', homeTeamCode: 'ARG', awayTeamCode: 'ESP' }),
      createMatch({ externalId: 202, group: 'C', homeTeamCode: 'BRA', awayTeamCode: 'FRA' }),
    ]);

    const response = await requestJson<{ prediction: { group: string; orderedTeamCodes: string[]; orderedTeams: Array<{ code: string }> } }>(
      '/predictions/groups',
      {
        token,
        body: { group: 'c', orderedTeamCodes: ['bra', 'arg', 'fra', 'esp'] },
      }
    );

    expect(response.status).toBe(200);
    expect(response.body.prediction).toMatchObject({
      group: 'C',
      orderedTeamCodes: ['BRA', 'ARG', 'FRA', 'ESP'],
    });
    expect(response.body.prediction.orderedTeams.map((team) => team.code)).toEqual(['BRA', 'ARG', 'FRA', 'ESP']);
  });

  it('rejects duplicate, incomplete, unknown, unconfirmed, and locked group predictions', async () => {
    const { token } = await registerPlayer();
    await Promise.all([
      createMatch({ externalId: 301, group: 'D', homeTeamCode: 'ARG', awayTeamCode: 'ESP' }),
      createMatch({ externalId: 302, group: 'D', homeTeamCode: 'BRA', awayTeamCode: 'FRA' }),
      createMatch({ externalId: 303, group: 'E', homeTeamCode: 'ARG', awayTeamCode: 'TBD' }),
      createMatch({
        externalId: 304,
        group: 'F',
        homeTeamCode: 'ARG',
        awayTeamCode: 'ESP',
        utcDate: new Date(Date.now() - 60 * 1000),
      }),
    ]);

    const duplicate = await requestJson('/predictions/groups', {
      token,
      body: { group: 'D', orderedTeamCodes: ['ARG', 'ARG', 'BRA', 'FRA'] },
    });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body).toEqual({ error: 'Each team can only appear once in a group prediction.' });

    const incomplete = await requestJson('/predictions/groups', {
      token,
      body: { group: 'D', orderedTeamCodes: ['ARG', 'ESP'] },
    });
    expect(incomplete.status).toBe(400);
    expect(incomplete.body).toEqual({ error: 'Group prediction must include all confirmed teams in this group.' });

    const unknown = await requestJson('/predictions/groups', {
      token,
      body: { group: 'Z', orderedTeamCodes: ['ARG', 'ESP'] },
    });
    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual({ error: 'Group not found' });

    const unconfirmed = await requestJson('/predictions/groups', {
      token,
      body: { group: 'E', orderedTeamCodes: ['ARG', 'TBD'] },
    });
    expect(unconfirmed.status).toBe(400);
    expect(unconfirmed.body).toEqual({ error: 'Group predictions are not available until all teams are confirmed.' });

    const locked = await requestJson('/predictions/groups', {
      token,
      body: { group: 'F', orderedTeamCodes: ['ARG', 'ESP'] },
    });
    expect(locked.status).toBe(400);
    expect(locked.body).toEqual({ error: 'Group predictions are locked.' });
  });

  it('locks group predictions using the global poll deadline', async () => {
    const { token } = await registerPlayer();
    await createMatch({ externalId: 401, group: 'G', homeTeamCode: 'ARG', awayTeamCode: 'ESP' });

    const beforeDeadline = await requestJson('/predictions/groups', {
      token,
      body: { group: 'G', orderedTeamCodes: ['ARG', 'ESP'] },
    });
    expect(beforeDeadline.status).toBe(200);

    const master = await registerPlayer('master@wc2026.test');
    const update = await requestJson('/config/poll', {
      method: 'PATCH',
      token: master.token,
      body: {
        groupPredictionsDeadline: new Date(Date.now() - 60 * 1000).toISOString(),
      },
    });
    expect(update.status).toBe(200);

    const afterDeadline = await requestJson('/predictions/groups', {
      token,
      body: { group: 'G', orderedTeamCodes: ['ESP', 'ARG'] },
    });
    expect(afterDeadline.status).toBe(400);
    expect(afterDeadline.body).toEqual({ error: 'Group predictions are locked.' });
  });
});

describe('tournament predictions', () => {
  it('locks tournament predictions using the global poll deadline', async () => {
    const player = await registerPlayer();
    const master = await registerPlayer('master@wc2026.test');
    await createMatch({ externalId: 501, homeTeamCode: 'ARG', awayTeamCode: 'ESP' });

    const open = await requestJson('/predictions/tournament', {
      token: player.token,
      body: { champion: { code: 'ARG' } },
    });
    expect(open.status).toBe(200);

    const update = await requestJson('/config/poll', {
      method: 'PATCH',
      token: master.token,
      body: {
        tournamentPredictionsDeadline: new Date(Date.now() - 60 * 1000).toISOString(),
      },
    });
    expect(update.status).toBe(200);

    const locked = await requestJson('/predictions/tournament', {
      token: player.token,
      body: { champion: { code: 'ESP' } },
    });
    expect(locked.status).toBe(400);
    expect(locked.body).toEqual({ error: 'Tournament predictions are locked.' });
  });
});

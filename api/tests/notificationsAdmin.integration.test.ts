import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDatabase, requestJson, startIntegrationServer, stopIntegrationServer } from './helpers/integration';
import { PushSubscription } from '../src/models/PushSubscription';

const pushMocks = vi.hoisted(() => ({
  sendToAll: vi.fn().mockResolvedValue(undefined),
  sendToUser: vi.fn().mockResolvedValue(undefined),
  sendToUsers: vi.fn().mockResolvedValue(undefined),
}));

const syncMocks = vi.hoisted(() => ({
  syncAllFixtures: vi.fn().mockResolvedValue({ fixturesSynced: 3 }),
  processFinishedMatches: vi.fn().mockResolvedValue({
    matchesProcessed: 2,
    predictionsScored: 5,
    leaguesUpdated: 2,
  }),
}));

vi.mock('../src/services/pushService', () => pushMocks);
vi.mock('../src/services/syncService', () => syncMocks);

beforeAll(async () => {
  await startIntegrationServer();
});

beforeEach(async () => {
  await clearDatabase();
  vi.clearAllMocks();
});

afterAll(async () => {
  await stopIntegrationServer();
});

async function registerPlayer(email: string, name = 'Player') {
  const response = await requestJson<{ token: string; user: { id: string; isMaster: boolean } }>('/auth/register', {
    body: { email, name, password: 'valid-password' },
  });
  expect(response.status).toBe(201);
  return response.body;
}

describe('notification routes', () => {
  it('returns the VAPID public key without auth', async () => {
    const response = await requestJson<{ publicKey: string }>('/notifications/vapid-public-key');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ publicKey: 'test-public-key' });
  });

  it('subscribes, updates, and deletes push subscriptions for the current user', async () => {
    const { token, user } = await registerPlayer('player@wc2026.test');
    const endpoint = 'https://push.example.test/subscription/1';

    const created = await requestJson('/notifications/subscribe', {
      token,
      body: { endpoint, keys: { p256dh: 'key-1', auth: 'auth-1' } },
    });
    expect(created.status).toBe(200);
    expect(created.body).toEqual({ ok: true });

    const updated = await requestJson('/notifications/subscribe', {
      token,
      body: { endpoint, keys: { p256dh: 'key-2', auth: 'auth-2' } },
    });
    expect(updated.status).toBe(200);

    const stored = await PushSubscription.find({ endpoint }).lean();
    expect(stored).toHaveLength(1);
    expect(String(stored[0].userId)).toBe(user.id);
    expect(stored[0].keys.auth).toBe('auth-2');

    const invalid = await requestJson('/notifications/subscribe', {
      token,
      body: { endpoint: 'not-a-url', keys: { p256dh: '', auth: '' } },
    });
    expect(invalid.status).toBe(400);

    const missingEndpoint = await requestJson('/notifications/subscribe', {
      method: 'DELETE',
      token,
      body: {},
    });
    expect(missingEndpoint.status).toBe(400);

    const deleted = await requestJson('/notifications/subscribe', {
      method: 'DELETE',
      token,
      body: { endpoint },
    });
    expect(deleted.status).toBe(200);
    expect(await PushSubscription.countDocuments({ endpoint })).toBe(0);
  });

  it('sends test notifications to the current user', async () => {
    const { token, user } = await registerPlayer('player@wc2026.test');

    const response = await requestJson('/notifications/test', { token, body: {} });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(pushMocks.sendToUser).toHaveBeenCalledWith(user.id, {
      title: 'Test notification',
      body: 'Push notifications are working!',
      url: '/',
    });
  });

  it('allows only master users to broadcast notifications', async () => {
    const master = await registerPlayer('master@wc2026.test', 'Master');
    const player = await registerPlayer('player@wc2026.test');

    const forbidden = await requestJson('/notifications/broadcast', {
      token: player.token,
      body: { title: 'Hello', body: 'Everyone' },
    });
    expect(forbidden.status).toBe(403);

    const invalid = await requestJson('/notifications/broadcast', {
      token: master.token,
      body: { title: '', body: 'Everyone' },
    });
    expect(invalid.status).toBe(400);

    const sent = await requestJson('/notifications/broadcast', {
      token: master.token,
      body: { title: 'Hello', body: 'Everyone' },
    });
    expect(sent.status).toBe(200);
    expect(sent.body).toEqual({ ok: true });
    expect(pushMocks.sendToAll).toHaveBeenCalledWith({ title: 'Hello', body: 'Everyone', url: '/' });
  });
});

describe('admin sync route', () => {
  it('requires a valid sync API key', async () => {
    const missing = await requestJson('/admin/sync', {
      body: { syncFixtures: false, processResults: true },
    });
    expect(missing.status).toBe(401);

    const invalid = await requestJson('/admin/sync', {
      headers: { 'x-sync-api-key': 'wrong-key' },
      body: { syncFixtures: false, processResults: true },
    });
    expect(invalid.status).toBe(401);
  });

  it('validates requested sync actions and can process results without syncing fixtures', async () => {
    const noActions = await requestJson('/admin/sync', {
      headers: { 'x-sync-api-key': 'test-sync-key' },
      body: { syncFixtures: false, processResults: false },
    });
    expect(noActions.status).toBe(400);

    const response = await requestJson<{ ok: boolean; matchesProcessed: number; predictionsScored: number; leaguesUpdated: number; fixturesSynced: number }>(
      '/admin/sync',
      {
        headers: { 'x-sync-api-key': 'test-sync-key' },
        body: { syncFixtures: false, processResults: true },
      }
    );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      syncFixtures: false,
      processResults: true,
      fixturesSynced: 0,
      matchesProcessed: 2,
      predictionsScored: 5,
      leaguesUpdated: 2,
    });
    expect(syncMocks.syncAllFixtures).not.toHaveBeenCalled();
    expect(syncMocks.processFinishedMatches).toHaveBeenCalledOnce();
  });

  it('rejects fixture sync when the football data API key is not configured', async () => {
    const response = await requestJson('/admin/sync', {
      headers: { 'x-sync-api-key': 'test-sync-key' },
      body: { syncFixtures: true, processResults: false },
    });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: 'FOOTBALL_DATA_API_KEY is not configured on the server' });
    expect(syncMocks.syncAllFixtures).not.toHaveBeenCalled();
  });
});

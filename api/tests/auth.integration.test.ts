import crypto from 'crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDatabase, requestJson, startIntegrationServer, stopIntegrationServer } from './helpers/integration';
import { User } from '../src/models/User';
import { env } from '../src/config/env';

function mockResendSend(providerMessageId = 'email-reset-1') {
  env.RESEND_API_KEY = 'test-resend-key';
  env.EMAIL_FROM = 'World Porra <notifications@worldporra.test>';
  const realFetch = globalThis.fetch;

  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (url === 'https://api.resend.com/emails') {
      return new Response(JSON.stringify({ id: providerMessageId }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    return realFetch(input, init);
  });
}

beforeAll(async () => {
  await startIntegrationServer();
});

beforeEach(async () => {
  vi.restoreAllMocks();
  env.RESEND_API_KEY = '';
  env.EMAIL_FROM = '';
  env.EMAIL_REPLY_TO = '';
  await clearDatabase();
});

afterAll(async () => {
  await stopIntegrationServer();
});

describe('auth routes', () => {
  it('registers a password user, normalizes email, and returns the authenticated profile', async () => {
    const register = await requestJson<{ token: string; user: { id: string; email: string; name: string; isMaster: boolean } }>(
      '/auth/register',
      {
        body: {
          email: 'MASTER@WORLDPORRA.TEST',
          name: 'Master Player',
          password: 'correct-horse-battery',
        },
      }
    );

    expect(register.status).toBe(201);
    expect(register.body.user).toMatchObject({
      email: 'master@worldporra.test',
      name: 'Master Player',
      isMaster: true,
    });
    expect(register.body.token).toEqual(expect.any(String));

    const storedUser = await User.findOne({ email: 'master@worldporra.test' }).select('+passwordHash').lean();
    expect(storedUser?.passwordHash).toEqual(expect.any(String));
    expect(storedUser?.passwordHash).not.toContain('correct-horse-battery');

    const me = await requestJson<{ user: { id: string; email: string } }>('/auth/me', {
      token: register.body.token,
    });
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({
      id: register.body.user.id,
      email: 'master@worldporra.test',
    });
  });

  it('rejects invalid registration payloads and duplicate password accounts', async () => {
    const invalid = await requestJson('/auth/register', {
      body: { email: 'not-an-email', name: '', password: 'short' },
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body).toMatchObject({ error: 'Invalid registration data' });

    await requestJson('/auth/register', {
      body: { email: 'player@worldporra.test', name: 'Player', password: 'valid-password' },
    });
    const duplicate = await requestJson('/auth/register', {
      body: { email: 'PLAYER@WORLDPORRA.TEST', name: 'Other', password: 'valid-password' },
    });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({ error: 'An account with this email already exists' });
  });

  it('logs in with a password and rejects bad credentials', async () => {
    await requestJson('/auth/register', {
      body: { email: 'player@worldporra.test', name: 'Player', password: 'valid-password' },
    });

    const badPassword = await requestJson('/auth/login', {
      body: { email: 'player@worldporra.test', password: 'wrong-password' },
    });
    expect(badPassword.status).toBe(401);
    expect(badPassword.body).toEqual({ error: 'Invalid email or password' });

    const login = await requestJson<{ token: string; user: { email: string; name: string } }>('/auth/login', {
      body: { email: 'PLAYER@WORLDPORRA.TEST', password: 'valid-password' },
    });
    expect(login.status).toBe(200);
    expect(login.body.token).toEqual(expect.any(String));
    expect(login.body.user).toMatchObject({ email: 'player@worldporra.test', name: 'Player' });
  });

  it('resets a password with a one-time email recovery token', async () => {
    await requestJson('/auth/register', {
      body: { email: 'player@worldporra.test', name: 'Player', password: 'old-password' },
    });

    const resendFetch = mockResendSend();
    const resetToken = Buffer.alloc(32, 7).toString('hex');
    vi.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.alloc(32, 7));

    const forgot = await requestJson('/auth/password/forgot', {
      body: { email: 'PLAYER@WORLDPORRA.TEST' },
    });
    expect(forgot.status).toBe(200);
    expect(forgot.body).toEqual({ ok: true });
    expect(resendFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Reset your World Porra password'),
      })
    );

    const storedWithReset = await User.findOne({ email: 'player@worldporra.test' })
      .select('+passwordResetTokenHash')
      .lean();
    expect(storedWithReset?.passwordResetTokenHash).toEqual(expect.any(String));
    expect(storedWithReset?.passwordResetTokenHash).not.toBe(resetToken);
    expect(storedWithReset?.passwordResetExpiresAt?.getTime()).toBeGreaterThan(Date.now());

    const reset = await requestJson<{ token: string; user: { email: string } }>('/auth/password/reset', {
      body: { token: resetToken, password: 'new-password' },
    });
    expect(reset.status).toBe(200);
    expect(reset.body.token).toEqual(expect.any(String));
    expect(reset.body.user.email).toBe('player@worldporra.test');

    const oldLogin = await requestJson('/auth/login', {
      body: { email: 'player@worldporra.test', password: 'old-password' },
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await requestJson('/auth/login', {
      body: { email: 'player@worldporra.test', password: 'new-password' },
    });
    expect(newLogin.status).toBe(200);

    const reused = await requestJson('/auth/password/reset', {
      body: { token: resetToken, password: 'another-password' },
    });
    expect(reused.status).toBe(400);
    expect(reused.body).toEqual({ error: 'Invalid or expired password reset token' });
  });

  it('does not create a reset token when password reset email is not configured', async () => {
    await requestJson('/auth/register', {
      body: { email: 'player@worldporra.test', name: 'Player', password: 'old-password' },
    });

    const response = await requestJson('/auth/password/forgot', {
      body: { email: 'player@worldporra.test' },
    });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: 'Password reset emails are temporarily unavailable' });

    const storedUser = await User.findOne({ email: 'player@worldporra.test' })
      .select('+passwordResetTokenHash')
      .lean();
    expect(storedUser?.passwordResetTokenHash).toBeNull();
    expect(storedUser?.passwordResetExpiresAt).toBeNull();
  });

  it('does not reveal whether a password reset email exists', async () => {
    const resendFetch = mockResendSend();

    const response = await requestJson('/auth/password/forgot', {
      body: { email: 'missing@worldporra.test' },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(resendFetch).not.toHaveBeenCalledWith('https://api.resend.com/emails', expect.anything());
  });

  it('protects authenticated routes from missing and invalid tokens', async () => {
    const missing = await requestJson('/auth/me');
    expect(missing.status).toBe(401);
    expect(missing.body).toEqual({ error: 'Missing or invalid Authorization header' });

    const invalid = await requestJson('/auth/me', { token: 'not-a-real-token' });
    expect(invalid.status).toBe(401);
    expect(invalid.body).toEqual({ error: 'Invalid or expired token' });
  });

  it('updates the authenticated user display name', async () => {
    const register = await requestJson<{ token: string; user: { id: string } }>('/auth/register', {
      body: {
        email: 'player@worldporra.test',
        name: 'Long Original Name',
        password: 'valid-password',
      },
    });

    const updated = await requestJson<{ user: { id: string; name: string } }>('/auth/me', {
      method: 'PATCH',
      token: register.body.token,
      body: { name: 'Pablo' },
    });
    expect(updated.status).toBe(200);
    expect(updated.body.user).toMatchObject({ id: register.body.user.id, name: 'Pablo' });

    const invalid = await requestJson('/auth/me', {
      method: 'PATCH',
      token: register.body.token,
      body: { name: '' },
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body).toMatchObject({ error: 'Invalid profile data' });
  });
});

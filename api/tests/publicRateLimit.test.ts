import { describe, expect, it } from 'vitest';
import { Request } from 'express';
import { isAuthorizedCronRequest } from '../src/middleware/publicRateLimit';

function request(path: string, headers: Record<string, string> = {}): Request {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );

  return {
    path,
    headers: normalizedHeaders,
    header: (name: string) => normalizedHeaders[name.toLowerCase()],
  } as Request;
}

describe('isAuthorizedCronRequest', () => {
  const config = {
    CRON_SECRET: 'cron-secret',
    SYNC_API_KEY: 'sync-key',
  };

  it('allows authorized cron calls to bypass the public API limiter', () => {
    expect(
      isAuthorizedCronRequest(request('/cron/sync-results', { 'x-sync-api-key': 'sync-key' }), config)
    ).toBe(true);

    expect(
      isAuthorizedCronRequest(request('/cron/daily-odds', { authorization: 'Bearer cron-secret' }), config)
    ).toBe(true);
  });

  it('keeps non-cron and unauthorized cron calls rate limited', () => {
    expect(
      isAuthorizedCronRequest(request('/matches', { 'x-sync-api-key': 'sync-key' }), config)
    ).toBe(false);

    expect(
      isAuthorizedCronRequest(request('/cron/sync-results', { 'x-sync-api-key': 'wrong-key' }), config)
    ).toBe(false);
  });
});

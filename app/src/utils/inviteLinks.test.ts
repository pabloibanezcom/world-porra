import { afterEach, describe, expect, it } from 'vitest';
import { buildInviteUrl, parseInviteCodeFromUrl, parseInviteFromUrl, parsePasswordResetTokenFromUrl } from './inviteLinks';

describe('invite link helpers', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_APP_URL;
  });

  it('builds hosted join links by default', () => {
    expect(buildInviteUrl('k7m9q2rx')).toBe('https://app.worldporra.com/join/K7M9Q2RX');
  });

  it('adds the league name to shared join links', () => {
    expect(buildInviteUrl('k7m9q2rx', 'Office Champions')).toBe(
      'https://app.worldporra.com/join/K7M9Q2RX?league=Office+Champions'
    );
  });

  it('uses the configured app URL without duplicate slashes', () => {
    process.env.EXPO_PUBLIC_APP_URL = 'https://example.test/app///';
    expect(buildInviteUrl('ABC123')).toBe('https://example.test/app/join/ABC123');
  });

  it('parses path and query invite codes', () => {
    expect(parseInviteCodeFromUrl('https://app.worldporra.com/join/k7m9q2rx')).toBe('K7M9Q2RX');
    expect(parseInviteCodeFromUrl('worldporra://join/F4V8M2QA')).toBe('F4V8M2QA');
    expect(parseInviteCodeFromUrl('https://app.worldporra.com/?invite=p9h3t7wk')).toBe('P9H3T7WK');
    expect(parseInviteCodeFromUrl('https://app.worldporra.com/?code=N6Q4R8YL')).toBe('N6Q4R8YL');
  });

  it('parses the league name from invite links', () => {
    expect(parseInviteFromUrl('https://app.worldporra.com/join/k7m9q2rx?league=Office+Champions')).toEqual({
      code: 'K7M9Q2RX',
      leagueName: 'Office Champions',
    });
  });

  it('ignores invalid invite codes', () => {
    expect(parseInviteCodeFromUrl('https://app.worldporra.com/join/no')).toBeNull();
    expect(parseInviteCodeFromUrl('https://app.worldporra.com/join/too-long-code')).toBeNull();
  });

  it('parses password reset tokens from links', () => {
    const token = 'a'.repeat(64);
    expect(parsePasswordResetTokenFromUrl(`https://app.worldporra.com/reset-password?token=${token}`)).toBe(token);
    expect(parsePasswordResetTokenFromUrl(`worldporra://reset-password/${token}`)).toBe(token);
    expect(parsePasswordResetTokenFromUrl('https://app.worldporra.com/reset-password?token=short')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/utils/password';

describe('password utilities', () => {
  it('hashes passwords with per-call salts and verifies the original password', async () => {
    const firstHash = await hashPassword('valid-password');
    const secondHash = await hashPassword('valid-password');

    expect(firstHash).not.toBe(secondHash);
    expect(firstHash).not.toContain('valid-password');
    await expect(verifyPassword('valid-password', firstHash)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', firstHash)).resolves.toBe(false);
  });

  it('rejects malformed stored hashes without throwing', async () => {
    await expect(verifyPassword('valid-password', '')).resolves.toBe(false);
    await expect(verifyPassword('valid-password', 'missing-separator')).resolves.toBe(false);
    await expect(verifyPassword('valid-password', 'salt:not-hex')).resolves.toBe(false);
  });
});

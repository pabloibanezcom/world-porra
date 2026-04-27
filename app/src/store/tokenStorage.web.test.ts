import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteToken, getToken, setToken } from './tokenStorage.web';

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
    }),
  });
});

describe('web token storage', () => {
  it('stores, reads, and deletes tokens from localStorage', async () => {
    await setToken('token-key', 'token-value');
    await expect(getToken('token-key')).resolves.toBe('token-value');

    await deleteToken('token-key');
    await expect(getToken('token-key')).resolves.toBeNull();
  });
});

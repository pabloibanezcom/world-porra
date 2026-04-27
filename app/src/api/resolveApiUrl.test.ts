import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadResolveApiUrl({
  apiUrl,
  hostUri,
  platform,
  dev = true,
}: {
  apiUrl?: string;
  hostUri?: string;
  platform: string;
  dev?: boolean;
}) {
  vi.resetModules();
  vi.stubGlobal('__DEV__', dev);
  if (apiUrl === undefined) {
    delete process.env.EXPO_PUBLIC_API_URL;
  } else {
    process.env.EXPO_PUBLIC_API_URL = apiUrl;
  }

  vi.doMock('expo-constants', () => ({
    default: { expoConfig: hostUri ? { hostUri } : {} },
  }));
  vi.doMock('react-native', () => ({
    Platform: { OS: platform },
  }));

  return import('./resolveApiUrl');
}

describe('resolveApiUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.doUnmock('expo-constants');
    vi.doUnmock('react-native');
    delete process.env.EXPO_PUBLIC_API_URL;
  });

  it('prefers configured API URLs and strips trailing slashes', async () => {
    const { resolveApiUrl } = await loadResolveApiUrl({
      apiUrl: 'https://api.example.test///',
      platform: 'ios',
    });

    expect(resolveApiUrl()).toBe('https://api.example.test');
  });

  it('derives a LAN API URL from Expo host URI', async () => {
    const { resolveApiUrl } = await loadResolveApiUrl({
      hostUri: '192.168.1.25:8081',
      platform: 'ios',
    });

    expect(resolveApiUrl()).toBe('http://192.168.1.25:3000');
  });

  it('uses the Android emulator host during local development', async () => {
    const { resolveApiUrl } = await loadResolveApiUrl({
      hostUri: 'localhost:8081',
      platform: 'android',
    });

    expect(resolveApiUrl()).toBe('http://10.0.2.2:3000');
  });

  it('falls back to localhost for non-Android local development', async () => {
    const { resolveApiUrl } = await loadResolveApiUrl({
      hostUri: 'localhost:8081',
      platform: 'ios',
    });

    expect(resolveApiUrl()).toBe('http://localhost:3000');
  });
});

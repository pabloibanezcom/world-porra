import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadResolveApiUrl({
  apiUrl,
  apiPreset,
  apiScenario,
  hostUri,
  platform,
  href,
  dev = true,
}: {
  apiUrl?: string;
  apiPreset?: string;
  apiScenario?: string;
  hostUri?: string;
  platform: string;
  href?: string;
  dev?: boolean;
}) {
  vi.resetModules();
  vi.stubGlobal('__DEV__', dev);
  if (apiUrl === undefined) {
    delete process.env.EXPO_PUBLIC_API_URL;
  } else {
    process.env.EXPO_PUBLIC_API_URL = apiUrl;
  }
  if (apiPreset === undefined) {
    delete process.env.EXPO_PUBLIC_API_PRESET;
  } else {
    process.env.EXPO_PUBLIC_API_PRESET = apiPreset;
  }
  if (apiScenario === undefined) {
    delete process.env.EXPO_PUBLIC_API_SCENARIO;
  } else {
    process.env.EXPO_PUBLIC_API_SCENARIO = apiScenario;
  }
  if (href === undefined) {
    vi.stubGlobal('window', undefined);
  } else {
    vi.stubGlobal('window', { location: { href } });
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
    delete process.env.EXPO_PUBLIC_API_PRESET;
    delete process.env.EXPO_PUBLIC_API_SCENARIO;
  });

  it('prefers the Vercel API preset over configured local URLs', async () => {
    const { resolveApiUrl } = await loadResolveApiUrl({
      apiUrl: 'http://localhost:3000',
      apiPreset: 'vercel',
      platform: 'ios',
    });

    expect(resolveApiUrl()).toBe('https://wc2026-pool-api.vercel.app');
  });

  it('prefers configured API URLs and strips trailing slashes', async () => {
    const { resolveApiUrl } = await loadResolveApiUrl({
      apiUrl: 'https://api.example.test///',
      platform: 'ios',
    });

    expect(resolveApiUrl()).toBe('https://api.example.test');
  });

  it('uses the hosted API for production web builds when the configured URL is local', async () => {
    const { resolveApiUrl } = await loadResolveApiUrl({
      apiUrl: 'http://localhost:3000',
      platform: 'web',
      dev: false,
    });

    expect(resolveApiUrl()).toBe('https://wc2026-pool-api.vercel.app');
  });

  it('uses the hosted API when a build scenario is active and the configured URL is local', async () => {
    const { resolveApiUrl } = await loadResolveApiUrl({
      apiUrl: 'http://localhost:3000',
      apiScenario: 'pre-tournament',
      platform: 'ios',
    });

    expect(resolveApiUrl()).toBe('https://wc2026-pool-api.vercel.app');
  });

  it('uses the hosted API when a web URL scenario is active and the configured URL is local', async () => {
    const { resolveApiUrl } = await loadResolveApiUrl({
      apiUrl: 'http://localhost:3000',
      href: 'http://localhost:8081/?scenario=pre-tournament',
      platform: 'web',
    });

    expect(resolveApiUrl()).toBe('https://wc2026-pool-api.vercel.app');
  });

  it('uses the hosted API for runtime scenarios when the resolved URL is local', async () => {
    const { resolveApiUrlForScenario } = await loadResolveApiUrl({
      apiUrl: 'http://localhost:3000',
      platform: 'ios',
    });

    expect(resolveApiUrlForScenario('pre-tournament')).toBe('https://wc2026-pool-api.vercel.app');
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

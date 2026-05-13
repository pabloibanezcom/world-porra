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

    expect(resolveApiUrl()).toBe('https://world-porra-api.vercel.app');
  });

  it('prefers configured API URLs and strips trailing slashes', async () => {
    const { resolveApiUrl } = await loadResolveApiUrl({
      apiUrl: 'https://api.example.test///',
      platform: 'ios',
    });

    expect(resolveApiUrl()).toBe('https://api.example.test');
  });

  it('normalizes the retired Vercel API URL to the active hosted API', async () => {
    const { resolveApiUrl } = await loadResolveApiUrl({
      apiUrl: 'https://wc2026-pool-api.vercel.app///',
      platform: 'web',
    });

    expect(resolveApiUrl()).toBe('https://world-porra-api.vercel.app');
  });

  it('uses the hosted API for production web builds when the configured URL is local', async () => {
    const { resolveApiUrl } = await loadResolveApiUrl({
      apiUrl: 'http://localhost:3000',
      platform: 'web',
      dev: false,
    });

    expect(resolveApiUrl()).toBe('https://world-porra-api.vercel.app');
  });

  it('uses the hosted API when a build scenario is active and the configured URL is local', async () => {
    const { resolveApiUrl } = await loadResolveApiUrl({
      apiUrl: 'http://localhost:3000',
      apiScenario: 'pre-tournament',
      platform: 'ios',
    });

    expect(resolveApiUrl()).toBe('https://world-porra-api.vercel.app');
  });

  it('uses the hosted API when a web URL scenario is active and the configured URL is local', async () => {
    const { resolveApiUrl } = await loadResolveApiUrl({
      apiUrl: 'http://localhost:3000',
      href: 'http://localhost:8081/?scenario=pre-tournament',
      platform: 'web',
    });

    expect(resolveApiUrl()).toBe('https://world-porra-api.vercel.app');
  });

  it('respects explicitly configured local API URLs for runtime scenarios', async () => {
    const { resolveApiUrlForScenario } = await loadResolveApiUrl({
      apiUrl: 'http://localhost:3000',
      platform: 'ios',
    });

    expect(resolveApiUrlForScenario('pre-tournament')).toBe('http://localhost:3000');
  });

  it('uses the hosted API for runtime scenarios when no API URL is configured', async () => {
    const { resolveApiUrlForScenario } = await loadResolveApiUrl({
      platform: 'ios',
    });

    expect(resolveApiUrlForScenario('pre-tournament')).toBe('https://world-porra-api.vercel.app');
  });

  it('uses the hosted API instead of deriving a LAN URL by default', async () => {
    const { resolveApiUrl } = await loadResolveApiUrl({
      hostUri: '192.168.1.25:8081',
      platform: 'ios',
    });

    expect(resolveApiUrl()).toBe('https://world-porra-api.vercel.app');
  });

  it('uses the hosted API for Android local development by default', async () => {
    const { resolveApiUrl } = await loadResolveApiUrl({
      hostUri: 'localhost:8081',
      platform: 'android',
    });

    expect(resolveApiUrl()).toBe('https://world-porra-api.vercel.app');
  });

  it('uses the hosted API for non-Android local development by default', async () => {
    const { resolveApiUrl } = await loadResolveApiUrl({
      hostUri: 'localhost:8081',
      platform: 'ios',
    });

    expect(resolveApiUrl()).toBe('https://world-porra-api.vercel.app');
  });
});

import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_API_PORT = '3000';
const LOCALHOST_API_URL = `http://localhost:${DEFAULT_API_PORT}`;
const VERCEL_API_URL = 'https://wc2026-pool-api.vercel.app';

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function extractHostname(hostUri: string): string | null {
  try {
    const normalized = hostUri.includes('://') ? hostUri : `http://${hostUri}`;
    return new URL(normalized).hostname;
  } catch {
    const fallback = hostUri.match(/^([^/:]+)/);
    return fallback?.[1] ?? null;
  }
}

function isLocalApiUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['localhost', '127.0.0.1', '10.0.2.2'].includes(url.hostname);
  } catch {
    return false;
  }
}

export function resolveApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_PRESET?.trim().toLowerCase() === 'vercel') {
    return VERCEL_API_URL;
  }

  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!__DEV__ && Platform.OS === 'web' && (!configuredUrl || isLocalApiUrl(configuredUrl))) {
    return VERCEL_API_URL;
  }

  if (configuredUrl) {
    return stripTrailingSlash(configuredUrl);
  }

  const expoHost = Constants.expoConfig?.hostUri ? extractHostname(Constants.expoConfig.hostUri) : null;
  if (expoHost && expoHost !== 'localhost' && expoHost !== '127.0.0.1') {
    return `http://${expoHost}:${DEFAULT_API_PORT}`;
  }

  if (__DEV__ && Platform.OS === 'android') {
    return `http://10.0.2.2:${DEFAULT_API_PORT}`;
  }

  return LOCALHOST_API_URL;
}

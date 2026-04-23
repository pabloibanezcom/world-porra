import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_API_PORT = '3000';
const LOCALHOST_API_URL = `http://localhost:${DEFAULT_API_PORT}`;

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

export function resolveApiUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
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

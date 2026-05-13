import { Platform } from 'react-native';

export const VERCEL_API_URL = 'https://world-porra-api.vercel.app';
const LEGACY_VERCEL_API_HOSTS = new Set(['wc2026-pool-api.vercel.app']);

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeApiUrl(value: string): string {
  const strippedUrl = stripTrailingSlash(value);
  try {
    const url = new URL(strippedUrl);
    return LEGACY_VERCEL_API_HOSTS.has(url.hostname) ? VERCEL_API_URL : strippedUrl;
  } catch {
    return strippedUrl;
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

function normalizeScenario(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized !== 'base' && normalized !== 'default' ? normalized : '';
}

function getInitialApiScenario(): string {
  const buildScenario = normalizeScenario(process.env.EXPO_PUBLIC_API_SCENARIO);
  if (buildScenario) return buildScenario;

  if (Platform.OS !== 'web' || typeof window === 'undefined') return '';

  try {
    return normalizeScenario(new URL(window.location.href).searchParams.get('scenario'));
  } catch {
    return '';
  }
}

export function resolveApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_PRESET?.trim().toLowerCase() === 'vercel') {
    return VERCEL_API_URL;
  }

  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  const initialScenario = getInitialApiScenario();
  if (initialScenario && (!configuredUrl || isLocalApiUrl(configuredUrl))) {
    return VERCEL_API_URL;
  }

  if (!__DEV__ && Platform.OS === 'web' && (!configuredUrl || isLocalApiUrl(configuredUrl))) {
    return VERCEL_API_URL;
  }

  if (configuredUrl) {
    return normalizeApiUrl(configuredUrl);
  }

  return VERCEL_API_URL;
}

export function resolveApiUrlForScenario(scenario: string | null | undefined): string {
  const resolvedUrl = resolveApiUrl();
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configuredUrl) {
    return resolvedUrl;
  }

  return normalizeScenario(scenario) && isLocalApiUrl(resolvedUrl) ? VERCEL_API_URL : resolvedUrl;
}

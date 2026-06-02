import { Platform } from 'react-native';
import { apiClient } from './client';
import { getToken, setToken } from '../store/tokenStorage';

const DEVICE_ID_STORAGE_KEY = 'world-porra.device-id';

type DisplayMode = 'browser' | 'standalone' | 'unknown';
type DevicePlatform = 'web' | 'ios' | 'android' | 'unknown';

function createDeviceId(): string {
  const cryptoApi = typeof crypto !== 'undefined' ? crypto : null;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  return `device-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

async function getDeviceId(): Promise<string> {
  const existing = await getToken(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;

  const next = createDeviceId();
  await setToken(DEVICE_ID_STORAGE_KEY, next);
  return next;
}

function getDisplayMode(): DisplayMode {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'unknown';

  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  if (window.matchMedia?.('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true) {
    return 'standalone';
  }

  return 'browser';
}

function getPlatform(): DevicePlatform {
  if (Platform.OS === 'ios' || Platform.OS === 'android') return Platform.OS;
  if (Platform.OS === 'web') return 'web';
  return 'unknown';
}

export async function sendDeviceHeartbeat(): Promise<void> {
  try {
    await apiClient.post('/devices/heartbeat', {
      deviceId: await getDeviceId(),
      displayMode: getDisplayMode(),
      platform: getPlatform(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      browserLanguage: typeof navigator !== 'undefined' ? navigator.language : '',
    });
  } catch {
    // Device tracking should never interrupt auth/session flows.
  }
}

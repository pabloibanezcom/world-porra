import axios from 'axios';
import * as Localization from 'expo-localization';
import { resolveApiUrl, resolveApiUrlForScenario } from './resolveApiUrl';
import { getActiveApiScenario } from './scenario';
import { deleteToken, getToken } from '../store/tokenStorage';
import { TOKEN_STORAGE_KEY } from '../store/tokenKey';

let apiBaseUrl = resolveApiUrl();
export const API_URL = apiBaseUrl;
const LANGUAGE_STORAGE_KEY = 'wc2026.language';
let activeLanguage: 'en' | 'es' | null = null;

export function setApiLanguage(language: 'en' | 'es') {
  activeLanguage = language;
}

function getDeviceLanguage(): 'en' | 'es' {
  const locale = Localization.getLocales()[0];
  const languageCode = locale?.languageCode?.toLowerCase();
  const languageTag = locale?.languageTag?.toLowerCase();
  const browserLanguage =
    typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('es') ? 'es' : undefined;

  return languageCode === 'es' || languageTag?.startsWith('es-') || browserLanguage === 'es' ? 'es' : 'en';
}

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

if (__DEV__) {
  console.log(`[api] Using base URL: ${apiBaseUrl}`);
}

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

export function setApiScenarioBaseUrl(scenario: string | null | undefined): string {
  const nextBaseUrl = resolveApiUrlForScenario(scenario);
  if (nextBaseUrl !== apiBaseUrl) {
    apiBaseUrl = nextBaseUrl;
    apiClient.defaults.baseURL = nextBaseUrl;
    if (__DEV__) {
      console.log(`[api] Using base URL: ${apiBaseUrl}`);
    }
  }

  return apiBaseUrl;
}

apiClient.interceptors.request.use(async (config) => {
  const token = await getToken(TOKEN_STORAGE_KEY);
  const apiScenario = await getActiveApiScenario();
  config.baseURL = setApiScenarioBaseUrl(apiScenario);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (apiScenario) {
    config.headers['X-WC-Scenario'] = apiScenario;
  }
  const savedLanguage = activeLanguage ?? await getToken(LANGUAGE_STORAGE_KEY);
  config.headers['Accept-Language'] = savedLanguage === 'es' || savedLanguage === 'en' ? savedLanguage : getDeviceLanguage();
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await deleteToken(TOKEN_STORAGE_KEY);
    }
    return Promise.reject(error);
  }
);

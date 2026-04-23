import axios from 'axios';
import { resolveApiUrl } from './resolveApiUrl';
import { deleteToken, getToken } from '../store/tokenStorage';
import { TOKEN_STORAGE_KEY } from '../store/tokenKey';

const API_URL = resolveApiUrl();

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

if (__DEV__) {
  console.log(`[api] Using base URL: ${API_URL}`);
}

apiClient.interceptors.request.use(async (config) => {
  const token = await getToken(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
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

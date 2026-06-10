import { apiClient } from './client';
import { User } from '../types';

interface AuthResponse {
  token: string;
  user: User;
}

export async function registerWithPassword(email: string, name: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', { email, name, password });
  return data;
}

export async function loginWithPassword(email: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', { email, password });
  return data;
}

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/google', { idToken });
  return data;
}

export async function requestPasswordReset(email: string): Promise<void> {
  await apiClient.post('/auth/password/forgot', { email });
}

export async function resetPassword(token: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/password/reset', { token, password });
  return data;
}

export async function loginDev(email?: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/dev', email ? { email } : undefined);
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<{ user: User }>('/auth/me');
  return data.user;
}

export async function updateMe(name: string): Promise<User> {
  const { data } = await apiClient.patch<{ user: User }>('/auth/me', { name });
  return data.user;
}

import { apiClient } from './client';
import { User } from '../types';

interface AuthResponse {
  token: string;
  user: User;
}

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/google', { idToken });
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<{ user: User }>('/auth/me');
  return data.user;
}

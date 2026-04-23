import { Platform } from 'react-native';
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { User } from '../types';
import { loginWithGoogle, loginDev, getMe } from '../api/auth';

const TOKEN_KEY = 'wc2026_token';

const storage = {
  get: (key: string): Promise<string | null> =>
    Platform.OS === 'web'
      ? Promise.resolve(localStorage.getItem(key))
      : SecureStore.getItemAsync(key),

  set: (key: string, value: string): Promise<void> =>
    Platform.OS === 'web'
      ? Promise.resolve(localStorage.setItem(key, value))
      : SecureStore.setItemAsync(key, value),

  delete: (key: string): Promise<void> =>
    Platform.OS === 'web'
      ? Promise.resolve(localStorage.removeItem(key))
      : SecureStore.deleteItemAsync(key),
};

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signInDev: () => Promise<void>;
  restoreSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  signInWithGoogle: async (idToken: string) => {
    const { token, user } = await loginWithGoogle(idToken);
    await storage.set(TOKEN_KEY, token);
    set({ user, token, isLoading: false });
  },

  signInDev: async () => {
    const { token, user } = await loginDev();
    await storage.set(TOKEN_KEY, token);
    set({ user, token, isLoading: false });
  },

  restoreSession: async () => {
    try {
      const token = await storage.get(TOKEN_KEY);
      if (!token) {
        set({ isLoading: false });
        return;
      }
      const user = await getMe();
      set({ user, token, isLoading: false });
    } catch {
      await storage.delete(TOKEN_KEY);
      set({ user: null, token: null, isLoading: false });
    }
  },

  signOut: async () => {
    await storage.delete(TOKEN_KEY);
    set({ user: null, token: null });
  },
}));

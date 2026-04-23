import { create } from 'zustand';
import { getToken, setToken, deleteToken } from './tokenStorage';
import { User } from '../types';
import { loginWithGoogle, loginDev, getMe } from '../api/auth';

const TOKEN_KEY = 'wc2026_token';

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
    await setToken(TOKEN_KEY, token);
    set({ user, token, isLoading: false });
  },

  signInDev: async () => {
    const { token, user } = await loginDev();
    await setToken(TOKEN_KEY, token);
    set({ user, token, isLoading: false });
  },

  restoreSession: async () => {
    try {
      const token = await getToken(TOKEN_KEY);
      if (!token) {
        set({ isLoading: false });
        return;
      }
      const user = await getMe();
      set({ user, token, isLoading: false });
    } catch {
      await deleteToken(TOKEN_KEY);
      set({ user: null, token: null, isLoading: false });
    }
  },

  signOut: async () => {
    await deleteToken(TOKEN_KEY);
    set({ user: null, token: null });
  },
}));

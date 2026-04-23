import { create } from 'zustand';
import { getToken, setToken, deleteToken } from './tokenStorage';
import { TOKEN_STORAGE_KEY } from './tokenKey';
import { User } from '../types';
import { loginWithGoogle, loginWithPassword, loginDev, getMe } from '../api/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signInDev: () => Promise<void>;
  restoreSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  signInWithPassword: async (email: string, password: string) => {
    const { token, user } = await loginWithPassword(email, password);
    await setToken(TOKEN_STORAGE_KEY, token);
    set({ user, token, isLoading: false });
  },

  signInWithGoogle: async (idToken: string) => {
    const { token, user } = await loginWithGoogle(idToken);
    await setToken(TOKEN_STORAGE_KEY, token);
    set({ user, token, isLoading: false });
  },

  signInDev: async () => {
    const { token, user } = await loginDev();
    await setToken(TOKEN_STORAGE_KEY, token);
    set({ user, token, isLoading: false });
  },

  restoreSession: async () => {
    try {
      const token = await getToken(TOKEN_STORAGE_KEY);
      if (!token) {
        set({ isLoading: false });
        return;
      }
      const user = await getMe();
      set({ user, token, isLoading: false });
    } catch {
      await deleteToken(TOKEN_STORAGE_KEY);
      set({ user: null, token: null, isLoading: false });
    }
  },

  signOut: async () => {
    await deleteToken(TOKEN_STORAGE_KEY);
    set({ user: null, token: null });
  },
}));

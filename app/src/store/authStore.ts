import { create } from 'zustand';
import { getToken, setToken, deleteToken } from './tokenStorage';
import { TOKEN_STORAGE_KEY } from './tokenKey';
import { User } from '../types';
import { loginWithGoogle, loginWithPassword, loginDev, getMe, updateMe, registerWithPassword } from '../api/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  register: (email: string, name: string, password: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signInDev: (email?: string) => Promise<void>;
  restoreSession: () => Promise<void>;
  updateProfileName: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  register: async (email: string, name: string, password: string) => {
    const { token, user } = await registerWithPassword(email, name, password);
    await setToken(TOKEN_STORAGE_KEY, token);
    set({ user, token, isLoading: false });
  },

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

  signInDev: async (email?: string) => {
    const { token, user } = await loginDev(email);
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

  updateProfileName: async (name: string) => {
    const user = await updateMe(name);
    set({ user });
  },

  signOut: async () => {
    await deleteToken(TOKEN_STORAGE_KEY);
    set({ user: null, token: null });
  },
}));

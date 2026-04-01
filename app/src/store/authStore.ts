import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { User } from '../types';
import { loginWithGoogle, getMe } from '../api/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signInWithGoogle: (idToken: string) => Promise<void>;
  restoreSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  signInWithGoogle: async (idToken: string) => {
    const { token, user } = await loginWithGoogle(idToken);
    await SecureStore.setItemAsync('token', token);
    set({ user, token, isLoading: false });
  },

  restoreSession: async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) {
        set({ isLoading: false });
        return;
      }
      const user = await getMe();
      set({ user, token, isLoading: false });
    } catch {
      await SecureStore.deleteItemAsync('token');
      set({ user: null, token: null, isLoading: false });
    }
  },

  signOut: async () => {
    await SecureStore.deleteItemAsync('token');
    set({ user: null, token: null });
  },
}));

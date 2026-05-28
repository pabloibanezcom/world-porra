import { create } from 'zustand';
import { getToken, setToken, deleteToken } from './tokenStorage';

const STORAGE_KEY = 'world-porra.pendingLeagueCreationInvite';
const TOKEN_PATTERN = /^[a-f0-9]{32}$/iu;

interface PendingLeagueCreationInviteState {
  pendingToken: string | null;
  hydrate: () => Promise<void>;
  setPendingToken: (token: string) => Promise<void>;
  clearPendingToken: () => Promise<void>;
}

export const usePendingLeagueCreationInviteStore = create<PendingLeagueCreationInviteState>((set) => ({
  pendingToken: null,

  hydrate: async () => {
    const token = await getToken(STORAGE_KEY);
    set({ pendingToken: token && TOKEN_PATTERN.test(token) ? token : null });
  },

  setPendingToken: async (token: string) => {
    if (!TOKEN_PATTERN.test(token)) return;
    await setToken(STORAGE_KEY, token);
    set({ pendingToken: token });
  },

  clearPendingToken: async () => {
    await deleteToken(STORAGE_KEY);
    set({ pendingToken: null });
  },
}));

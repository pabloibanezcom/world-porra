import { create } from 'zustand';
import { getToken, setToken, deleteToken } from './tokenStorage';
import { normalizeInviteCode, normalizeInviteLeagueName } from '../utils/inviteLinks';

const PENDING_INVITE_CODE_STORAGE_KEY = 'world-porra.pendingInviteCode';
const PENDING_INVITE_LEAGUE_NAME_STORAGE_KEY = 'world-porra.pendingInviteLeagueName';

interface PendingInviteState {
  pendingInviteCode: string | null;
  pendingInviteLeagueName: string | null;
  hydratePendingInvite: () => Promise<void>;
  setPendingInvite: (inviteCode: string, leagueName?: string | null) => Promise<void>;
  clearPendingInviteCode: () => Promise<void>;
}

export const usePendingInviteStore = create<PendingInviteState>((set) => ({
  pendingInviteCode: null,
  pendingInviteLeagueName: null,

  hydratePendingInvite: async () => {
    const inviteCode = normalizeInviteCode(await getToken(PENDING_INVITE_CODE_STORAGE_KEY));
    const leagueName = normalizeInviteLeagueName(await getToken(PENDING_INVITE_LEAGUE_NAME_STORAGE_KEY));
    set({ pendingInviteCode: inviteCode, pendingInviteLeagueName: inviteCode ? leagueName : null });
  },

  setPendingInvite: async (inviteCode: string, leagueName?: string | null) => {
    const normalizedInviteCode = normalizeInviteCode(inviteCode);
    if (!normalizedInviteCode) return;

    const normalizedLeagueName = normalizeInviteLeagueName(leagueName);
    await setToken(PENDING_INVITE_CODE_STORAGE_KEY, normalizedInviteCode);
    if (normalizedLeagueName) {
      await setToken(PENDING_INVITE_LEAGUE_NAME_STORAGE_KEY, normalizedLeagueName);
    } else {
      await deleteToken(PENDING_INVITE_LEAGUE_NAME_STORAGE_KEY);
    }
    set({ pendingInviteCode: normalizedInviteCode, pendingInviteLeagueName: normalizedLeagueName });
  },

  clearPendingInviteCode: async () => {
    await deleteToken(PENDING_INVITE_CODE_STORAGE_KEY);
    await deleteToken(PENDING_INVITE_LEAGUE_NAME_STORAGE_KEY);
    set({ pendingInviteCode: null, pendingInviteLeagueName: null });
  },
}));

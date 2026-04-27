import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './authStore';
import { TOKEN_STORAGE_KEY } from './tokenKey';
import { deleteToken, getToken, setToken } from './tokenStorage';
import { getMe, loginDev, loginWithGoogle, loginWithPassword } from '../api/auth';

vi.mock('./tokenStorage', () => ({
  getToken: vi.fn(),
  setToken: vi.fn(),
  deleteToken: vi.fn(),
}));

vi.mock('../api/auth', () => ({
  loginWithPassword: vi.fn(),
  loginWithGoogle: vi.fn(),
  loginDev: vi.fn(),
  getMe: vi.fn(),
}));

const mockedGetToken = vi.mocked(getToken);
const mockedSetToken = vi.mocked(setToken);
const mockedDeleteToken = vi.mocked(deleteToken);
const mockedLoginWithPassword = vi.mocked(loginWithPassword);
const mockedLoginWithGoogle = vi.mocked(loginWithGoogle);
const mockedLoginDev = vi.mocked(loginDev);
const mockedGetMe = vi.mocked(getMe);

const user = {
  id: 'user-1',
  email: 'player@example.test',
  name: 'Player',
  avatarUrl: '',
  totalPoints: 0,
};

function resetStore() {
  useAuthStore.setState({ user: null, token: null, isLoading: true });
}

describe('auth store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('signs in with password and persists the returned token', async () => {
    mockedLoginWithPassword.mockResolvedValueOnce({ token: 'token-1', user });

    await useAuthStore.getState().signInWithPassword('player@example.test', 'password');

    expect(mockedLoginWithPassword).toHaveBeenCalledWith('player@example.test', 'password');
    expect(mockedSetToken).toHaveBeenCalledWith(TOKEN_STORAGE_KEY, 'token-1');
    expect(useAuthStore.getState()).toMatchObject({ user, token: 'token-1', isLoading: false });
  });

  it('signs in with Google and dev auth', async () => {
    mockedLoginWithGoogle.mockResolvedValueOnce({ token: 'google-token', user });
    await useAuthStore.getState().signInWithGoogle('id-token');
    expect(mockedLoginWithGoogle).toHaveBeenCalledWith('id-token');
    expect(useAuthStore.getState().token).toBe('google-token');

    mockedLoginDev.mockResolvedValueOnce({ token: 'dev-token', user: { ...user, id: 'dev-user' } });
    await useAuthStore.getState().signInDev();
    expect(mockedLoginDev).toHaveBeenCalledOnce();
    expect(useAuthStore.getState()).toMatchObject({
      token: 'dev-token',
      user: { id: 'dev-user' },
      isLoading: false,
    });
  });

  it('restores an existing token by fetching the current user', async () => {
    mockedGetToken.mockResolvedValueOnce('stored-token');
    mockedGetMe.mockResolvedValueOnce(user);

    await useAuthStore.getState().restoreSession();

    expect(mockedGetToken).toHaveBeenCalledWith(TOKEN_STORAGE_KEY);
    expect(mockedGetMe).toHaveBeenCalledOnce();
    expect(useAuthStore.getState()).toMatchObject({ user, token: 'stored-token', isLoading: false });
  });

  it('finishes loading without a token during restore', async () => {
    mockedGetToken.mockResolvedValueOnce(null);

    await useAuthStore.getState().restoreSession();

    expect(mockedGetMe).not.toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({ user: null, token: null, isLoading: false });
  });

  it('clears invalid stored tokens during restore', async () => {
    mockedGetToken.mockResolvedValueOnce('stale-token');
    mockedGetMe.mockRejectedValueOnce(new Error('Unauthorized'));

    await useAuthStore.getState().restoreSession();

    expect(mockedDeleteToken).toHaveBeenCalledWith(TOKEN_STORAGE_KEY);
    expect(useAuthStore.getState()).toMatchObject({ user: null, token: null, isLoading: false });
  });

  it('signs out by deleting the token and clearing user state', async () => {
    useAuthStore.setState({ user, token: 'token-1', isLoading: false });

    await useAuthStore.getState().signOut();

    expect(mockedDeleteToken).toHaveBeenCalledWith(TOKEN_STORAGE_KEY);
    expect(useAuthStore.getState()).toMatchObject({ user: null, token: null, isLoading: false });
  });
});

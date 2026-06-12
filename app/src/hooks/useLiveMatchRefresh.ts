import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import type { Match } from '../types';
import { getMatchRefreshDelay } from '../utils/matchRefresh';

type RefreshableMatch = Pick<Match, 'status' | 'utcDate'>;

function isAppActive(state: AppStateStatus) {
  return state === 'active';
}

export function useLiveMatchRefresh(matches: RefreshableMatch[], refresh: () => void | Promise<void>) {
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(() => isAppActive(AppState.currentState));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setAppActive(isAppActive(state));
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isFocused || !appActive) return undefined;

    const refreshDelay = getMatchRefreshDelay(matches);
    if (refreshDelay == null) return undefined;

    const timeout = setTimeout(() => {
      refresh();
    }, refreshDelay);

    return () => clearTimeout(timeout);
  }, [appActive, isFocused, matches, refresh]);
}

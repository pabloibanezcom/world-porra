import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { fetchMatches } from '../api/matches';
import { fetchPollConfig, fetchTournamentCatalog, PollConfig } from '../api/config';
import {
  fetchMyGroupPredictions,
  fetchMyPredictions,
  fetchTournamentPrediction,
  saveTournamentPrediction,
  submitGroupPrediction,
  submitPrediction,
} from '../api/predictions';
import {
  GroupPrediction,
  Match,
  PlayerOption,
  Prediction,
  TeamInfo,
  TeamOption,
  TournamentCatalogTeam,
  TournamentPicks,
} from '../types';
import { useI18n } from '../i18n';
import { getApiErrorMessage } from '../utils/apiError';

const LIVE_SCORE_REFRESH_MS = 60 * 1000;
const FINAL_FOUR_KEYS = ['champion', 'runnerUp', 'semi1', 'semi2'] as const;

export interface GroupStanding {
  id: string;
  teams: TeamInfo[];
}

function isTbdTeam(team: TeamInfo) {
  return team.code.trim().toUpperCase() === 'TBD' || team.name.trim().toUpperCase() === 'TBD';
}

function getGroupsFromMatches(matches: Match[]): GroupStanding[] {
  const groups = new Map<string, Map<string, TeamInfo>>();

  matches.forEach((match) => {
    if (match.stage !== 'GROUP' || !match.group) return;

    const group = groups.get(match.group) ?? new Map<string, TeamInfo>();
    [match.homeTeam, match.awayTeam].forEach((team) => {
      const code = team.code.trim().toUpperCase();
      if (code && !isTbdTeam(team)) {
        group.set(code, { ...team, code });
      }
    });
    groups.set(match.group, group);
  });

  return Array.from(groups.entries())
    .map(([id, teams]) => ({
      id,
      teams: Array.from(teams.values()).sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((group) => group.teams.length >= 2)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function getTournamentTeamsFromMatches(matches: Match[]): TournamentCatalogTeam[] {
  const teams = new Map<string, TournamentCatalogTeam>();

  matches.forEach((match) => {
    [match.homeTeam, match.awayTeam].forEach((team) => {
      const code = team.code.trim().toUpperCase();
      if (code && !isTbdTeam(team)) {
        teams.set(code, { ...team, code, players: [] });
      }
    });
  });

  return Array.from(teams.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function mergeTournamentTeams(
  fallbackTeams: TournamentCatalogTeam[],
  catalogTeams: TournamentCatalogTeam[],
): TournamentCatalogTeam[] {
  if (catalogTeams.length === 0) return fallbackTeams;

  const catalogByCode = new Map(catalogTeams.map((team) => [team.code, team]));
  return fallbackTeams.map((team) => catalogByCode.get(team.code) ?? team);
}

export function usePicksData() {
  const { language, t } = useI18n();
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [groupPredictions, setGroupPredictions] = useState<GroupPrediction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pollConfig, setPollConfig] = useState<PollConfig | null>(null);
  const [tournamentTeams, setTournamentTeams] = useState<TournamentCatalogTeam[]>([]);
  const [tournamentPicks, setTournamentPicks] = useState<TournamentPicks>({});

  const predMap = useMemo(
    () => Object.fromEntries(predictions.map((prediction) => [prediction.matchId, prediction])) as Record<string, Prediction>,
    [predictions],
  );
  const groupPredMap = useMemo(
    () => Object.fromEntries(groupPredictions.map((prediction) => [prediction.group, prediction])) as Record<string, GroupPrediction>,
    [groupPredictions],
  );
  const groupStandings = useMemo(() => getGroupsFromMatches(matches), [matches]);

  const showErrorToast = useCallback((fallback: string, error?: unknown) => {
    Toast.show({
      type: 'error',
      text1: t('common.error'),
      text2: error ? getApiErrorMessage(error, fallback) : fallback,
    });
  }, [t]);

  const load = useCallback(async (options: { notifyOnError?: boolean } = {}) => {
    try {
      const [nextMatches, nextPredictions, nextGroupPredictions, config] = await Promise.all([
        fetchMatches({}),
        fetchMyPredictions(),
        fetchMyGroupPredictions(),
        fetchPollConfig(),
      ]);
      setMatches(nextMatches);
      setPredictions(nextPredictions);
      setGroupPredictions(nextGroupPredictions);
      setPollConfig(config);

      const fallbackTeams = getTournamentTeamsFromMatches(nextMatches);
      setTournamentTeams(fallbackTeams);
      fetchTournamentCatalog()
        .then((catalogTeams) => {
          setTournamentTeams(mergeTournamentTeams(fallbackTeams, catalogTeams));
        })
        .catch((error) => {
          if (options.notifyOnError) {
            showErrorToast(t('picks.catalogLoadFailed'), error);
          }
        });
    } catch (error) {
      if (options.notifyOnError) {
        showErrorToast(t('picks.loadFailed'), error);
      }
    } finally {
      setLoading(false);
    }
  }, [language, showErrorToast, t]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load({ notifyOnError: true });
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (!matches.some((match) => match.status === 'LIVE')) return;

    const interval = setInterval(() => {
      load();
    }, LIVE_SCORE_REFRESH_MS);

    return () => clearInterval(interval);
  }, [load, matches]);

  useEffect(() => {
    fetchTournamentPrediction()
      .then(setTournamentPicks)
      .catch(() => {});
  }, [language]);

  const handleSave = useCallback(async (matchId: string, score: [number, number], qualifier?: 'HOME' | 'AWAY' | null) => {
    try {
      const prediction = await submitPrediction(matchId, score[0], score[1], qualifier);
      setPredictions((prev) => [...prev.filter((item) => item.matchId !== matchId), prediction]);
    } catch (error) {
      showErrorToast(t('match.failedSave'), error);
    }
  }, [showErrorToast, t]);

  const handleGroupOrder = useCallback(async (groupId: string, orderedTeams: TeamInfo[]) => {
    if (pollConfig?.groupPredictionsLocked) return;

    setGroupPredictions((prev) => {
      const existing = prev.find((prediction) => prediction.group === groupId);
      const optimistic: GroupPrediction = existing
        ? { ...existing, orderedTeams, orderedTeamCodes: orderedTeams.map((team) => team.code) }
        : {
            _id: `local-${groupId}`,
            userId: '',
            group: groupId,
            orderedTeams,
            orderedTeamCodes: orderedTeams.map((team) => team.code),
            points: null,
          };

      return [...prev.filter((prediction) => prediction.group !== groupId), optimistic];
    });

    try {
      const saved = await submitGroupPrediction(groupId, orderedTeams);
      setGroupPredictions((prev) => [...prev.filter((prediction) => prediction.group !== groupId), saved]);
    } catch (error) {
      showErrorToast(t('picks.groupSaveFailed'), error);
      await load();
    }
  }, [load, pollConfig?.groupPredictionsLocked, showErrorToast, t]);

  const handleTournamentPick = useCallback(
    (key: keyof TournamentPicks, value: TeamOption | PlayerOption) => {
      setTournamentPicks((prev) => {
        const next = { ...prev, [key]: value };
        if (FINAL_FOUR_KEYS.includes(key as typeof FINAL_FOUR_KEYS[number])) {
          FINAL_FOUR_KEYS.forEach((teamKey) => {
            if (teamKey !== key && next[teamKey]?.code === value.code) {
              delete next[teamKey];
            }
          });
        }
        saveTournamentPrediction(next).catch((error) => {
          showErrorToast(t('picks.tournamentSaveFailed'), error);
        });
        return next;
      });
    },
    [showErrorToast, t],
  );

  return {
    groupPredMap,
    groupPredictionsLocked: !!pollConfig?.groupPredictionsLocked,
    groupStandings,
    handleGroupOrder,
    handleSave,
    handleTournamentPick,
    loading,
    matches,
    onRefresh,
    predMap,
    refreshing,
    tournamentPicks,
    tournamentPredictionsLocked: !!pollConfig?.tournamentPredictionsLocked,
    tournamentTeams,
  };
}

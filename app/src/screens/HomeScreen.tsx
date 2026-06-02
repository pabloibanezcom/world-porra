import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ScrollTriggerProvider } from '../contexts/ScrollTrigger';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { useDataRefreshStore } from '../store/dataRefreshStore';
import { fetchMatches } from '../api/matches';
import { fetchMyGroupPredictions, fetchMyPredictions, fetchTournamentPrediction } from '../api/predictions';
import { fetchMyLeagues } from '../api/leagues';
import { fetchPollConfig, PollConfig } from '../api/config';
import { GroupPrediction, Match, Prediction, League, TOURNAMENT_SLOT_KEYS, TournamentPicks } from '../types';
import PredictionSheet from '../components/PredictionSheet';
import ResultSheet from '../components/ResultSheet';
import MatchCard, { hasTbdTeam } from '../components/MatchCard';
import LeagueCard from '../components/LeagueCard';
import Avatar from '../components/ui/Avatar';
import LoadingView from '../components/ui/LoadingView';
import { colors, fonts } from '../theme';
import { submitPrediction } from '../api/predictions';
import { useI18n } from '../i18n';
import { isPredictionLocked } from '../utils/prediction';

const LIVE_SCORE_REFRESH_MS = 60 * 1000;

function SectionLabel({ children }: { children: string }) {
  return (
    <Text style={styles.sectionLabel}>{children.toUpperCase()}</Text>
  );
}

function getResult(pred: Prediction, match: Match): 'exact' | 'correct' | 'wrong' | null {
  if (!match.result) return null;
  const { homeGoals, awayGoals } = match.result;
  if (pred.homeGoals === homeGoals && pred.awayGoals === awayGoals) return 'exact';
  const pOut = pred.homeGoals > pred.awayGoals ? 'h' : pred.homeGoals < pred.awayGoals ? 'a' : 'd';
  const aOut = homeGoals > awayGoals ? 'h' : homeGoals < awayGoals ? 'a' : 'd';
  return pOut === aOut ? 'correct' : 'wrong';
}

function getPredictableGroupSizes(matches: Match[]): Record<string, number> {
  const groups = new Map<string, Set<string>>();

  matches.forEach((match) => {
    if (match.stage !== 'GROUP' || !match.group) return;

    const groupTeams = groups.get(match.group) ?? new Set<string>();
    [match.homeTeam, match.awayTeam].forEach((team) => {
      const code = team.code.trim().toUpperCase();
      if (code && code !== 'TBD' && team.name.trim().toUpperCase() !== 'TBD') {
        groupTeams.add(code);
      }
    });
    groups.set(match.group, groupTeams);
  });

  return Object.fromEntries(
    Array.from(groups.entries())
      .filter(([, teams]) => teams.size >= 2)
      .map(([group, teams]) => [group, teams.size]),
  );
}

export default function HomeScreen() {
  const { language, t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const leaguesVersion = useDataRefreshStore((s) => s.leaguesVersion);
  const predictionsVersion = useDataRefreshStore((s) => s.predictionsVersion);
  const navigation = useNavigation<any>();
  const triggerRef = useRef<() => void>(() => {});
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [groupPredictions, setGroupPredictions] = useState<GroupPrediction[]>([]);
  const [tournamentPicks, setTournamentPicks] = useState<TournamentPicks>({});
  const [leagues, setLeagues] = useState<League[]>([]);
  const [pollConfig, setPollConfig] = useState<PollConfig | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedResult, setSelectedResult] = useState<Match | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const predMap = Object.fromEntries(predictions.map((p) => [p.matchId, p]));
  const groupPredMap = Object.fromEntries(groupPredictions.map((prediction) => [prediction.group, prediction]));

  const load = useCallback(async () => {
    try {
      const [m, p, groups, tournament, leagues, config] = await Promise.all([
        fetchMatches({}),
        fetchMyPredictions(),
        fetchMyGroupPredictions(),
        fetchTournamentPrediction(),
        fetchMyLeagues(),
        fetchPollConfig(),
      ]);
      setMatches(m);
      setPredictions(p);
      setGroupPredictions(groups);
      setTournamentPicks(tournament);
      setLeagues(leagues);
      setPollConfig(config);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [language]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
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
    if (loading) return;
    load();
  }, [leaguesVersion, predictionsVersion, load]);

  useEffect(() => {
    if (!matches.some((match) => match.status === 'LIVE')) return;

    const interval = setInterval(() => {
      load();
    }, LIVE_SCORE_REFRESH_MS);

    return () => clearInterval(interval);
  }, [load, matches]);

  const now = new Date(pollConfig?.serverTime ?? Date.now());
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const upcoming = [...matches]
    .filter((m) => {
      if (m.status === 'LIVE') return true;
      if (m.status !== 'SCHEDULED') return false;
      return new Date(m.utcDate) >= now;
    })
    .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
  const finished = matches.filter((m) => m.status === 'FINISHED');
  const matchesInNext24Hours = upcoming.filter((match) => {
    if (match.status === 'LIVE') {
      return true;
    }

    const kickoff = new Date(match.utcDate);
    return kickoff >= now && kickoff <= next24Hours;
  });
  const nextMatches =
    matchesInNext24Hours.length >= 3
      ? matchesInNext24Hours
      : upcoming.slice(0, 3);
  const recentFinished = [...finished].reverse().slice(0, 4);
  const missingPredictionMatches = upcoming.filter((match) => (
    match.status === 'SCHEDULED' &&
    !predMap[match._id] &&
    !hasTbdTeam(match) &&
    !isPredictionLocked(match)
  ));
  const missingMatchPredictionCount = missingPredictionMatches.length;
  const groupSizes = getPredictableGroupSizes(matches);
  const missingGroupPredictionCount = pollConfig?.groupPredictionsLocked
    ? 0
    : Object.entries(groupSizes).filter(([group, teamCount]) => {
        const prediction = groupPredMap[group];
        return !prediction || (prediction.orderedTeamCodes?.length ?? 0) < teamCount;
      }).length;
  const missingTournamentPredictionCount = pollConfig?.tournamentPredictionsLocked
    ? 0
    : TOURNAMENT_SLOT_KEYS.filter((key) => !tournamentPicks[key]).length;
  const missingPredictionCount =
    missingMatchPredictionCount + missingGroupPredictionCount + missingTournamentPredictionCount;

  const totalPoints = predictions.reduce((sum, prediction) => sum + (prediction.points ?? 0), 0);
  const pointsSummary = loadFailed ? `- ${t('common.points')}` : `${totalPoints} ${t('common.points')}`;
  const homeLeagues = leagues.slice(0, 2);

  const handleSave = async (matchId: string, score: [number, number], qualifier?: 'HOME' | 'AWAY' | null) => {
    const pred = await submitPrediction(matchId, score[0], score[1], qualifier);
    setPredictions((prev) => {
      const filtered = prev.filter((p) => p.matchId !== matchId);
      return [...filtered, pred];
    });
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('home.goodMorning') : hour < 18 ? t('home.goodAfternoon') : t('home.goodEvening');
  const firstName = user?.name?.split(' ')[0] || t('home.fan');

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LoadingView />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollTriggerProvider triggerRef={triggerRef}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        onScroll={() => triggerRef.current()}
        scrollEventThrottle={200}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting},</Text>
            <View style={styles.headerTitleRow}>
              <Text style={styles.userName}>{firstName}</Text>
              <Text style={styles.pointsSummary}>{pointsSummary}</Text>
            </View>
          </View>
        </View>

        {missingPredictionCount > 0 && (
          <Pressable
            style={({ pressed }) => [
              styles.predictionReminder,
              pressed && styles.predictionReminderPressed,
            ]}
            onPress={() => navigation.navigate('Predictions')}
          >
            <View style={styles.predictionReminderHeader}>
              <Text style={styles.predictionReminderTitle}>
                {t('home.predictionsAvailableTitle')}
              </Text>
              <Text style={styles.predictionReminderActionText}>
                {t('home.predictionsAvailableAction')}
              </Text>
            </View>
            <View style={styles.predictionReminderGrid}>
              {missingMatchPredictionCount > 0 && (
                <PredictionReminderTile
                  count={missingMatchPredictionCount}
                  label={t('home.predictionsAvailableMatchesLabel')}
                />
              )}
              {missingGroupPredictionCount > 0 && (
                <PredictionReminderTile
                  count={missingGroupPredictionCount}
                  label={t('home.predictionsAvailableGroupsLabel')}
                />
              )}
              {missingTournamentPredictionCount > 0 && (
                <PredictionReminderTile
                  count={missingTournamentPredictionCount}
                  label={t('home.predictionsAvailableFinalsLabel')}
                />
              )}
            </View>
          </Pressable>
        )}

        {/* Next matches */}
        {nextMatches.length > 0 && (
          <View>
            <SectionLabel>{t('home.nextMatches')}</SectionLabel>
            <View style={styles.nextMatchesList}>
              {nextMatches.map((match) => {
                const myPred = predMap[match._id] ?? null;
                const canPredict = !isPredictionLocked(match) && !hasTbdTeam(match);

                return (
                  <MatchCard
                    key={match._id}
                    match={match}
                    prediction={myPred}
                    onPress={canPredict ? () => setSelectedMatch(match) : undefined}
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* Leagues */}
        {homeLeagues.length > 0 && (
          <View>
            <SectionLabel>{t('home.leagues')}</SectionLabel>
            <View style={{ gap: 10 }}>
              {homeLeagues.map((league) => (
                <LeagueCard
                  key={league._id}
                  league={league}
                  userId={user?.id}
                  compact
                  onPress={() =>
                    navigation.navigate('Leagues', {
                      screen: 'LeagueDetail',
                      params: { leagueId: league._id },
                    })
                  }
                />
              ))}
            </View>
          </View>
        )}

        {/* Recent results */}
        {recentFinished.length > 0 && (
          <View>
            <SectionLabel>{t('home.recentResults')}</SectionLabel>
            <View style={{ gap: 10 }}>
              {recentFinished.map((m) => {
                const pred = predMap[m._id];
                const result = pred ? getResult(pred, m) : null;
                return (
                  <MatchCard
                    key={m._id}
                    match={m}
                    prediction={pred}
                    result={result}
                    onPress={() => setSelectedResult(m)}
                  />
                );
              })}
            </View>
          </View>
        )}

        {matches.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('home.noMatches')}</Text>
            <Text style={styles.emptySubtext}>{t('home.fixturesSynced')}</Text>
          </View>
        )}
      </ScrollView>
      </ScrollTriggerProvider>

      <PredictionSheet
        match={selectedMatch}
        existing={selectedMatch && predMap[selectedMatch._id]
          ? {
              score: [predMap[selectedMatch._id].homeGoals, predMap[selectedMatch._id].awayGoals],
              qualifier: predMap[selectedMatch._id].qualifier,
            }
          : undefined}
        onSave={handleSave}
        onClose={() => setSelectedMatch(null)}
      />
      <ResultSheet
        match={selectedResult}
        prediction={selectedResult ? predMap[selectedResult._id] : null}
        onClose={() => setSelectedResult(null)}
      />
    </SafeAreaView>
  );
}

function PredictionReminderTile({ count, label }: { count: number; label: string }) {
  return (
    <View style={styles.predictionReminderTile}>
      <Text style={styles.predictionReminderCount}>{count}</Text>
      <Text style={styles.predictionReminderTileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 18, paddingBottom: 16, gap: 18 },

  header: { marginTop: 4 },
  greeting: { color: colors.muted, fontSize: 13, marginBottom: 4, fontFamily: fonts.body },
  headerTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  userName: { color: colors.text, fontSize: 34, fontFamily: fonts.display, lineHeight: 38 },
  pointsSummary: { color: colors.accent, fontSize: 24, fontFamily: fonts.display, lineHeight: 28 },

  predictionReminder: {
    gap: 12,
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 12,
  },
  predictionReminderPressed: { opacity: 0.82 },
  predictionReminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  predictionReminderTitle: {
    color: colors.bg,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    minWidth: 0,
  },
  predictionReminderGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  predictionReminderTile: {
    flex: 1,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(15,17,21,0.16)',
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  predictionReminderCount: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 27,
  },
  predictionReminderTileLabel: {
    color: 'rgba(255,255,255,0.82)',
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
    marginTop: 2,
    textAlign: 'center',
  },
  predictionReminderActionText: {
    color: colors.bg,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    fontWeight: '700',
  },

  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: colors.dim,
    letterSpacing: 1.2, marginBottom: 8, fontFamily: fonts.bodyMedium,
  },

  nextMatchesList: { gap: 10 },

  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: colors.muted, fontSize: 16, fontWeight: '600' },
  emptySubtext: { color: colors.dim, fontSize: 13, marginTop: 4 },
});

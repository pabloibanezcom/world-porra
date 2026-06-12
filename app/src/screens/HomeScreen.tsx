import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ScrollTriggerProvider } from '../contexts/ScrollTrigger';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { useDataRefreshStore } from '../store/dataRefreshStore';
import { fetchMatches } from '../api/matches';
import { fetchMyPredictions } from '../api/predictions';
import { fetchMyLeagues } from '../api/leagues';
import { fetchPollConfig, PollConfig } from '../api/config';
import { Match, Prediction, League } from '../types';
import PredictionSheet from '../components/PredictionSheet';
import ResultSheet from '../components/ResultSheet';
import MatchPredictionsSheet from '../components/MatchPredictionsSheet';
import MatchCard, { hasTbdTeam } from '../components/MatchCard';
import LeagueCard from '../components/LeagueCard';
import Avatar from '../components/ui/Avatar';
import LoadingView from '../components/ui/LoadingView';
import LiveBadge from '../components/LiveBadge';
import { colors, fonts } from '../theme';
import { setPredictionJoker, submitPrediction } from '../api/predictions';
import { getJokerCategory } from '../hooks/usePicksData';
import { useI18n } from '../i18n';
import { isPredictionLocked } from '../utils/prediction';
import { getApiErrorMessage } from '../utils/apiError';
import { POST_KICKOFF_REFRESH_WINDOW_MS } from '../utils/matchRefresh';
import { calculateLivePotentialPoints } from '../utils/livePoints';
import { useLiveMatchRefresh } from '../hooks/useLiveMatchRefresh';

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

function kickoffTime(match: Match): number {
  return new Date(match.utcDate).getTime();
}

function isLiveOrInProgress(match: Match, now: Date): boolean {
  if (match.status === 'LIVE') return true;
  if (match.status !== 'SCHEDULED') return false;

  const kickoff = kickoffTime(match);
  if (!Number.isFinite(kickoff)) return false;

  const currentTime = now.getTime();
  return kickoff <= currentTime && currentTime <= kickoff + POST_KICKOFF_REFRESH_WINDOW_MS;
}

function cardMatchForHome(match: Match, now: Date): Match {
  if (match.status === 'SCHEDULED' && isLiveOrInProgress(match, now)) {
    return { ...match, status: 'LIVE' };
  }

  return match;
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
  const [leagues, setLeagues] = useState<League[]>([]);
  const [pollConfig, setPollConfig] = useState<PollConfig | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedResult, setSelectedResult] = useState<Match | null>(null);
  const [selectedPredictionsMatch, setSelectedPredictionsMatch] = useState<Match | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const predMap = Object.fromEntries(predictions.map((p) => [p.matchId, p]));

  const load = useCallback(async (options: { force?: boolean } = {}) => {
    try {
      const [m, p, leagues, config] = await Promise.all([
        fetchMatches({}),
        fetchMyPredictions(),
        fetchMyLeagues(),
        fetchPollConfig({ force: options.force }),
      ]);
      setMatches(m);
      setPredictions(p);
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
    await load({ force: true });
    setRefreshing(false);
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

  useLiveMatchRefresh(matches, load);

  const now = new Date(pollConfig?.serverTime ?? Date.now());
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const liveMatches = matches
    .filter((match) => isLiveOrInProgress(match, now))
    .sort((a, b) => kickoffTime(a) - kickoffTime(b));
  const upcoming = matches
    .filter((match) => match.status === 'SCHEDULED' && kickoffTime(match) >= now.getTime())
    .sort((a, b) => kickoffTime(a) - kickoffTime(b));
  const finished = matches.filter((m) => m.status === 'FINISHED');
  const matchesInNext24Hours = upcoming.filter((match) => {
    const kickoff = kickoffTime(match);
    return kickoff >= now.getTime() && kickoff <= next24Hours.getTime();
  });
  const nextMatches =
    matchesInNext24Hours.length >= 3
      ? matchesInNext24Hours
      : upcoming.slice(0, 3);
  const recentFinished = [...finished].reverse().slice(0, 2);

  const totalPoints = predictions.reduce((sum, prediction) => sum + (prediction.points ?? 0), 0);
  const pointsSummary = loadFailed ? `- ${t('common.points')}` : `${totalPoints} ${t('common.points')}`;
  const livePotentialPoints = liveMatches.reduce((sum, match) => {
    const potentialPoints = calculateLivePotentialPoints(cardMatchForHome(match, now), predMap[match._id] ?? null);
    return potentialPoints == null ? sum : sum + potentialPoints;
  }, 0);
  const showLivePotentialPoints = liveMatches.some((match) => !!cardMatchForHome(match, now).result);
  const homeLeagues = leagues.slice(0, 2);

  const handleSave = async (matchId: string, score: [number, number], qualifier?: 'HOME' | 'AWAY' | null) => {
    const pred = await submitPrediction(matchId, score[0], score[1], qualifier);
    setPredictions((prev) => {
      const filtered = prev.filter((p) => p.matchId !== matchId);
      return [...filtered, pred];
    });
  };

  const handleToggleJoker = async (matchId: string, active: boolean) => {
    try {
      const pred = await setPredictionJoker(matchId, active);
      setPredictions((prev) => [...prev.filter((p) => p.matchId !== matchId), pred]);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: t('common.error'),
        text2: getApiErrorMessage(error, t('match.failedSave')),
      });
      throw error;
    }
  };

  // Which match (if any) currently holds the joker in each stage category.
  const stageById = new Map(matches.map((match) => [match._id, match.stage]));
  const jokerMatchByCategory: Record<'GROUP' | 'KNOCKOUT', string | null> = { GROUP: null, KNOCKOUT: null };
  predictions.forEach((prediction) => {
    if (!prediction.joker) return;
    const stage = stageById.get(prediction.matchId);
    if (!stage) return;
    jokerMatchByCategory[getJokerCategory(stage)] = prediction.matchId;
  });
  const selectedJokerCategory = selectedMatch ? getJokerCategory(selectedMatch.stage) : null;
  const jokerHolderId = selectedJokerCategory ? jokerMatchByCategory[selectedJokerCategory] : null;
  const selectedJokerActive = !!selectedMatch && jokerHolderId === selectedMatch._id;
  const selectedJokerLockedByOther = !!jokerHolderId && !selectedJokerActive;

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
              <View style={styles.pointsBlock}>
                <Text style={styles.pointsSummary}>{pointsSummary}</Text>
                {showLivePotentialPoints && (
                  <View style={styles.livePotentialRow}>
                    <LiveBadge iconOnly />
                    <Text style={styles.livePotentialPoints}>
                      {t('home.livePotentialPoints', { points: livePotentialPoints })}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Live matches */}
        {liveMatches.length > 0 && (
          <View>
            <SectionLabel>{t('home.liveMatches')}</SectionLabel>
            <View style={styles.nextMatchesList}>
              {liveMatches.map((match) => {
                const myPred = predMap[match._id] ?? null;
                const sheetMatch = cardMatchForHome(match, now);
                const potentialPoints = calculateLivePotentialPoints(sheetMatch, myPred);

                return (
                  <MatchCard
                    key={match._id}
                    match={sheetMatch}
                    prediction={myPred}
                    potentialPoints={potentialPoints}
                    onPress={() => setSelectedPredictionsMatch(sheetMatch)}
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
                    onPress={
                      canPredict
                        ? () => setSelectedMatch(match)
                        : undefined
                    }
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
        jokerActive={selectedJokerActive}
        jokerLockedByOther={selectedJokerLockedByOther}
        onToggleJoker={handleToggleJoker}
        onClose={() => setSelectedMatch(null)}
      />
      <ResultSheet
        match={selectedResult}
        prediction={selectedResult ? predMap[selectedResult._id] : null}
        onClose={() => setSelectedResult(null)}
      />
      <MatchPredictionsSheet
        match={selectedPredictionsMatch}
        leagues={leagues}
        onClose={() => setSelectedPredictionsMatch(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 18, paddingBottom: 16, gap: 18 },

  header: { marginTop: 4 },
  greeting: { color: colors.muted, fontSize: 13, marginBottom: 4, fontFamily: fonts.body },
  headerTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  userName: { color: colors.text, fontSize: 34, fontFamily: fonts.display, lineHeight: 38 },
  pointsBlock: { alignItems: 'flex-end', justifyContent: 'flex-end' },
  pointsSummary: { color: colors.accent, fontSize: 24, fontFamily: fonts.display, lineHeight: 28 },
  livePotentialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 1,
  },
  livePotentialPoints: {
    color: colors.danger,
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    fontWeight: '800',
    lineHeight: 16,
    marginTop: 1,
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

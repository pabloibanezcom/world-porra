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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { fetchMatches } from '../api/matches';
import { fetchMyPredictions } from '../api/predictions';
import { fetchMyLeagues } from '../api/leagues';
import { fetchPollConfig, PollConfig } from '../api/config';
import { Match, Prediction, League } from '../types';
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

export default function HomeScreen() {
  const { language, t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const navigation = useNavigation<any>();
  const triggerRef = useRef<() => void>(() => {});
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [pollConfig, setPollConfig] = useState<PollConfig | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedResult, setSelectedResult] = useState<Match | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const predMap = Object.fromEntries(predictions.map((p) => [p.matchId, p]));

  const load = useCallback(async () => {
    try {
      const [m, p, leagues, config] = await Promise.all([
        fetchMatches({}),
        fetchMyPredictions(),
        fetchMyLeagues(),
        fetchPollConfig(),
      ]);
      setMatches(m);
      setPredictions(p);
      setLeagues(leagues);
      setPollConfig(config);
    } catch {
      // silently fail
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

  const totalPoints = user?.totalPoints ?? 0;
  const homeLeagues = leagues.slice(0, 2);

  const handleSave = async (matchId: string, score: [number, number], qualifier?: 'HOME' | 'AWAY' | null) => {
    try {
      const pred = await submitPrediction(matchId, score[0], score[1], qualifier);
      setPredictions((prev) => {
        const filtered = prev.filter((p) => p.matchId !== matchId);
        return [...filtered, pred];
      });
    } catch {
      // silently fail
    }
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
              <Text style={styles.pointsSummary}>{totalPoints} {t('common.points')}</Text>
            </View>
          </View>
        </View>

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 18, paddingBottom: 16, gap: 18 },

  header: { marginTop: 4 },
  greeting: { color: colors.muted, fontSize: 13, marginBottom: 4, fontFamily: fonts.body },
  headerTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  userName: { color: colors.text, fontSize: 34, fontFamily: fonts.display, lineHeight: 38 },
  pointsSummary: { color: colors.accent, fontSize: 24, fontFamily: fonts.display, lineHeight: 28 },

  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: colors.dim,
    letterSpacing: 1.2, marginBottom: 8, fontFamily: fonts.bodyMedium,
  },

  nextMatchesList: { gap: 10 },

  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: colors.muted, fontSize: 16, fontWeight: '600' },
  emptySubtext: { color: colors.dim, fontSize: 13, marginTop: 4 },
});

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { fetchMatches } from '../api/matches';
import { fetchMyPredictions } from '../api/predictions';
import { fetchMyLeagues } from '../api/leagues';
import { Match, Prediction, League } from '../types';
import PredictionSheet from '../components/PredictionSheet';
import MatchCard, { hasTbdTeam } from '../components/MatchCard';
import LeagueCard from '../components/LeagueCard';
import Flag from '../components/ui/Flag';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import LoadingView from '../components/ui/LoadingView';
import { colors, fonts } from '../theme';
import { submitPrediction } from '../api/predictions';
import { useI18n } from '../i18n';

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

function formatDate(utcDate: string, locale: string) {
  return new Date(utcDate).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

export default function HomeScreen() {
  const { language, t, locale } = useI18n();
  const user = useAuthStore((s) => s.user);
  const navigation = useNavigation<any>();
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const predMap = Object.fromEntries(predictions.map((p) => [p.matchId, p]));

  const load = useCallback(async () => {
    try {
      const [m, p, leagues] = await Promise.all([
        fetchMatches({}),
        fetchMyPredictions(),
        fetchMyLeagues(),
      ]);
      setMatches(m);
      setPredictions(p);
      setLeagues(leagues);
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

  const now = new Date();
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const upcoming = [...matches]
    .filter((m) => m.status === 'SCHEDULED' || m.status === 'LIVE')
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

  const handleSave = async (matchId: string, score: [number, number]) => {
    try {
      const pred = await submitPrediction(matchId, score[0], score[1]);
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
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
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
                const canPredict = !hasTbdTeam(match);

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
            <View style={{ gap: 8 }}>
              {recentFinished.map((m) => {
                const pred = predMap[m._id];
                const result = pred ? getResult(pred, m) : null;
                return (
                  <View key={m._id} style={styles.resultCard}>
                    <View style={styles.resultHeader}>
                      <Text style={styles.matchMeta}>
                        {m.group ? t('common.group', { group: m.group }) : m.stage} · {formatDate(m.utcDate, locale)}
                      </Text>
                      {result && <Badge result={result} />}
                    </View>
                    <View style={styles.matchRow}>
                      <View style={styles.teamSide}>
                        <Flag code={m.homeTeam.code} size={22} />
                        <Text style={styles.teamNameSm}>{m.homeTeam.name}</Text>
                      </View>
                      <View style={styles.scoreCenter}>
                        <Text style={styles.scoreResult}>
                          {m.result!.homeGoals} – {m.result!.awayGoals}
                        </Text>
                        {pred && (
                          <Text style={styles.yourPick}>
                            {t('common.yourPick')}: {pred.homeGoals}–{pred.awayGoals}
                          </Text>
                        )}
                      </View>
                      <View style={[styles.teamSide, styles.teamSideRight]}>
                        <Text style={styles.teamNameSm}>{m.awayTeam.name}</Text>
                        <Flag code={m.awayTeam.code} size={22} />
                      </View>
                    </View>
                  </View>
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

      <PredictionSheet
        match={selectedMatch}
        existing={selectedMatch && predMap[selectedMatch._id]
          ? [predMap[selectedMatch._id].homeGoals, predMap[selectedMatch._id].awayGoals]
          : undefined}
        onSave={handleSave}
        onClose={() => setSelectedMatch(null)}
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
  matchMeta: { color: colors.muted, fontSize: 11, fontFamily: fonts.body },
  matchRow: { flexDirection: 'row', alignItems: 'center' },
  teamSide: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamSideRight: { justifyContent: 'flex-end' },
  teamNameSm: { color: colors.text, fontSize: 14, fontFamily: fonts.displayBold },
  scoreCenter: { alignItems: 'center', paddingHorizontal: 10, minWidth: 70 },


  resultCard: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12, paddingHorizontal: 16 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  scoreResult: { color: colors.text, fontSize: 16, fontWeight: '700' },
  yourPick: { color: colors.dim, fontSize: 10, marginTop: 1 },

  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: colors.muted, fontSize: 16, fontWeight: '600' },
  emptySubtext: { color: colors.dim, fontSize: 13, marginTop: 4 },
});

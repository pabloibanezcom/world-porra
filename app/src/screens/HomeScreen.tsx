import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { fetchMatches } from '../api/matches';
import { fetchMyPredictions } from '../api/predictions';
import { fetchMyLeagues } from '../api/leagues';
import { Match, Prediction, League } from '../types';
import PredictionSheet from '../components/PredictionSheet';
import MatchCard from '../components/MatchCard';
import Flag from '../components/ui/Flag';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import { colors, fonts } from '../theme';
import { submitPrediction } from '../api/predictions';

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

function formatDate(utcDate: string) {
  return new Date(utcDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [league, setLeague] = useState<League | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const predMap = Object.fromEntries(predictions.map((p) => [p.matchId, p]));

  const load = async () => {
    try {
      const [m, p, leagues] = await Promise.all([
        fetchMatches({}),
        fetchMyPredictions(),
        fetchMyLeagues(),
      ]);
      setMatches(m);
      setPredictions(p);
      if (leagues.length > 0) setLeague(leagues[0]);
    } catch {
      // silently fail
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, []);

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

  const totalPoints = predictions.reduce((acc, p) => acc + (p.points ?? 0), 0);
  const exactCount = predictions.filter((p) => {
    const m = matches.find((x) => x._id === p.matchId);
    return m && getResult(p, m) === 'exact';
  }).length;

  const myRank = league
    ? (() => {
        const sorted = [...league.members].sort((a, b) => b.totalPoints - a.totalPoints);
        const idx = sorted.findIndex((m) => (m.userId as any)?.id === user?.id || (m.userId as any)?._id === user?.id);
        return idx >= 0 ? idx + 1 : '—';
      })()
    : '—';

  const accuracy =
    finished.length > 0
      ? Math.round((predictions.filter((p) => {
          const m = matches.find((x) => x._id === p.matchId);
          return m && getResult(p, m) !== 'wrong' && getResult(p, m) !== null;
        }).length / finished.length) * 100)
      : 0;

  const leaderboardMembers = league
    ? [...league.members].sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 3)
    : [];

  const memberColors = ['#494fdf', '#00a87e', '#e61e49', '#ec7e00'];

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
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'Fan';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}, {firstName}</Text>
            <Text style={styles.poolName}>{league?.name ?? 'World Cup Pool'} 🏆</Text>
          </View>
          <View style={styles.bellBtn}>
            <Text style={{ fontSize: 18 }}>🔔</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {[
            { label: 'Rank', value: `#${myRank}`, color: colors.accent },
            { label: 'Points', value: `${totalPoints}`, color: colors.text },
            { label: 'Played', value: `${finished.length}/${matches.length}`, color: colors.text },
            { label: 'Accuracy', value: `${accuracy}%`, color: colors.text },
          ].map(({ label, value, color }) => (
            <View key={label} style={styles.statCard}>
              <Text style={[styles.statValue, { color }]}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Next matches */}
        {nextMatches.length > 0 && (
          <View>
            <SectionLabel>Next Matches</SectionLabel>
            <View style={styles.nextMatchesList}>
              {nextMatches.map((match) => {
                const myPred = predMap[match._id] ?? null;

                return (
                  <MatchCard
                    key={match._id}
                    match={match}
                    prediction={myPred}
                    onPress={() => setSelectedMatch(match)}
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* Mini leaderboard */}
        {leaderboardMembers.length > 0 && (
          <View>
            <SectionLabel>Leaderboard</SectionLabel>
            <View style={styles.card}>
              {leaderboardMembers.map((member, i) => {
                const memberUser = member.userId as any;
                const name = memberUser?.name || 'Player';
                const isMe = memberUser?.id === user?.id || memberUser?._id === user?.id;
                return (
                  <View
                    key={i}
                    style={[
                      styles.leaderRow,
                      i < leaderboardMembers.length - 1 && styles.leaderRowBorder,
                      isMe && styles.leaderRowMe,
                    ]}
                  >
                    <Text style={styles.medal}>{['🥇', '🥈', '🥉'][i]}</Text>
                    <Avatar name={name} color={memberColors[i % memberColors.length]} size={32} />
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.leaderName}>{name}</Text>
                      {isMe && <View style={styles.youBadge}><Text style={styles.youText}>You</Text></View>}
                    </View>
                    <Text style={styles.leaderPts}>
                      {member.totalPoints}<Text style={styles.leaderPtsSuffix}> pts</Text>
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Recent results */}
        {recentFinished.length > 0 && (
          <View>
            <SectionLabel>Recent Results</SectionLabel>
            <View style={{ gap: 8 }}>
              {recentFinished.map((m) => {
                const pred = predMap[m._id];
                const result = pred ? getResult(pred, m) : null;
                return (
                  <View key={m._id} style={styles.resultCard}>
                    <View style={styles.resultHeader}>
                      <Text style={styles.matchMeta}>
                        {m.group ? `Group ${m.group}` : m.stage} · {formatDate(m.utcDate)}
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
                            your pick: {pred.homeGoals}–{pred.awayGoals}
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
            <Text style={styles.emptyText}>No matches yet.</Text>
            <Text style={styles.emptySubtext}>Fixtures will appear once synced.</Text>
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
  scroll: { padding: 18, paddingBottom: 32, gap: 18 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 4 },
  greeting: { color: colors.muted, fontSize: 12, marginBottom: 3, fontFamily: fonts.body },
  poolName: { color: colors.text, fontSize: 26, fontFamily: fonts.display },
  bellBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
    padding: 12, alignItems: 'center',
  },
  statValue: { fontSize: 17, fontWeight: '700', fontFamily: fonts.bodyMedium },
  statLabel: { color: colors.dim, fontSize: 9, marginTop: 2, fontFamily: fonts.body },

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

  card: { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, paddingHorizontal: 16 },
  leaderRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  leaderRowMe: { backgroundColor: 'rgba(73,79,223,0.05)' },
  medal: { width: 22, textAlign: 'center', fontSize: 16 },
  leaderName: { color: colors.text, fontSize: 14, fontWeight: '600', fontFamily: fonts.bodyMedium },
  youBadge: { backgroundColor: colors.blueDim, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 9999 },
  youText: { color: colors.blue, fontSize: 10 },
  leaderPts: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  leaderPtsSuffix: { color: colors.muted, fontSize: 10, fontWeight: '400' },

  resultCard: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 12, paddingHorizontal: 16 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  scoreResult: { color: colors.text, fontSize: 16, fontWeight: '700' },
  yourPick: { color: colors.dim, fontSize: 10, marginTop: 1 },

  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: colors.muted, fontSize: 16, fontWeight: '600' },
  emptySubtext: { color: colors.dim, fontSize: 13, marginTop: 4 },
});

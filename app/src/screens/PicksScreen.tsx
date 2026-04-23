import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchMatches } from '../api/matches';
import { fetchMyPredictions, submitPrediction } from '../api/predictions';
import { Match, Prediction } from '../types';
import PredictionSheet from '../components/PredictionSheet';
import MatchCard from '../components/MatchCard';
import { colors, fonts } from '../theme';

function getResult(pred: Prediction, match: Match): 'exact' | 'correct' | 'wrong' | null {
  if (!match.result) return null;
  const { homeGoals, awayGoals } = match.result;
  if (pred.homeGoals === homeGoals && pred.awayGoals === awayGoals) return 'exact';
  const pOut = pred.homeGoals > pred.awayGoals ? 'h' : pred.homeGoals < pred.awayGoals ? 'a' : 'd';
  const aOut = homeGoals > awayGoals ? 'h' : homeGoals < awayGoals ? 'a' : 'd';
  return pOut === aOut ? 'correct' : 'wrong';
}

export default function PicksScreen() {
  const [tab, setTab] = useState<'upcoming' | 'results'>('upcoming');
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const predMap = Object.fromEntries(predictions.map((p) => [p.matchId, p]));

  const load = async () => {
    try {
      const [m, p] = await Promise.all([fetchMatches({}), fetchMyPredictions()]);
      setMatches(m);
      setPredictions(p);
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

  const upcoming = matches.filter((m) => m.status === 'SCHEDULED' || m.status === 'LIVE');
  const finished = matches.filter((m) => m.status === 'FINISHED');
  const shown = tab === 'upcoming' ? upcoming : finished;

  const handleSave = async (matchId: string, score: [number, number]) => {
    try {
      const pred = await submitPrediction(matchId, score[0], score[1]);
      setPredictions((prev) => [...prev.filter((p) => p.matchId !== matchId), pred]);
    } catch {
      // silently fail
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>My Picks</Text>
          <Text style={styles.subtitle}>2026 FIFA World Cup · Group Stage</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {(['upcoming', 'results'] as const).map((t) => {
            const active = tab === t;
            const count = t === 'upcoming' ? upcoming.length : finished.length;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {t === 'upcoming' ? `Upcoming (${count})` : `Results (${count})`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Match list */}
        <View style={{ gap: 10 }}>
          {shown.map((m) => {
            const pred = predMap[m._id];
            const result = m.status === 'FINISHED' && pred ? getResult(pred, m) : null;
            const isUpcoming = m.status === 'SCHEDULED' || m.status === 'LIVE';

            return (
              <MatchCard
                key={m._id}
                match={m}
                prediction={pred}
                result={result}
                onPress={isUpcoming ? () => setSelectedMatch(m) : undefined}
              />
            );
          })}
        </View>

        {shown.length === 0 && !refreshing && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {tab === 'upcoming' ? 'No upcoming matches.' : 'No results yet.'}
            </Text>
          </View>
        )}
      </ScrollView>

      <PredictionSheet
        match={selectedMatch}
        existing={
          selectedMatch && predMap[selectedMatch._id]
            ? [predMap[selectedMatch._id].homeGoals, predMap[selectedMatch._id].awayGoals]
            : undefined
        }
        onSave={handleSave}
        onClose={() => setSelectedMatch(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 18, paddingBottom: 32, gap: 16 },

  titleRow: { marginTop: 4 },
  title: { color: colors.text, fontSize: 30, fontFamily: fonts.display },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 2, fontFamily: fonts.body },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.accent },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: '600', fontFamily: fonts.bodyMedium },
  tabTextActive: { color: '#fff' },

  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: colors.muted, fontSize: 14 },
});

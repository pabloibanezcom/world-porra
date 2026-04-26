import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { fetchMatches } from '../api/matches';
import { Match, MatchStage } from '../types';
import MatchCard from '../components/MatchCard';
import LoadingView from '../components/ui/LoadingView';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import { useI18n } from '../i18n';

const STAGES: { label: string; value: MatchStage }[] = [
  { label: 'Groups', value: 'GROUP' },
  { label: 'R32', value: 'ROUND_OF_32' },
  { label: 'R16', value: 'ROUND_OF_16' },
  { label: 'QF', value: 'QUARTER_FINAL' },
  { label: 'SF', value: 'SEMI_FINAL' },
  { label: 'Final', value: 'FINAL' },
];

export default function MatchListScreen() {
  const { language } = useI18n();
  const [activeStage, setActiveStage] = useState<MatchStage>('GROUP');
  const [matches, setMatches] = useState<Match[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation<any>();

  const loadMatches = async () => {
    try {
      const data = await fetchMatches({ stage: activeStage });
      setMatches(data);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadMatches();
  }, [activeStage, language]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMatches();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {STAGES.map(({ label, value }) => (
          <TouchableOpacity
            key={value}
            style={[styles.tab, activeStage === value && styles.activeTab]}
            onPress={() => setActiveStage(value)}
          >
            <Text style={[styles.tabText, activeStage === value && styles.activeTabText]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <LoadingView />
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <MatchCard match={item} onPress={() => navigation.navigate('MatchDetail', { matchId: item._id })} />
          )}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No matches for this stage yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: '#fff',
  },
  list: {
    padding: spacing.md,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
});

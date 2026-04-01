import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { fetchMatches } from '../api/matches';
import { Match } from '../types';
import MatchCard from '../components/MatchCard';
import { colors, spacing, fontSize } from '../theme';

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const [matches, setMatches] = useState<Match[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadMatches = async () => {
    try {
      const data = await fetchMatches({ status: 'SCHEDULED' });
      // Show next 10 upcoming matches
      setMatches(data.slice(0, 10));
    } catch {
      // silently fail — user will see empty state
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMatches();
    setRefreshing(false);
  };

  useEffect(() => {
    loadMatches();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'Fan'}!</Text>
        <Text style={styles.subtitle}>Upcoming matches</Text>
      </View>

      <FlatList
        data={matches}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <MatchCard match={item} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No upcoming matches yet.</Text>
            <Text style={styles.emptySubtext}>Matches will appear once fixtures are synced.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    backgroundColor: colors.primary,
  },
  greeting: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: spacing.xs,
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
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
});

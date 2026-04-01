import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { fetchMyLeagues } from '../api/leagues';
import { League } from '../types';
import { colors, spacing, fontSize, borderRadius } from '../theme';

export default function LeaguesScreen() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation<any>();

  const loadLeagues = async () => {
    try {
      const data = await fetchMyLeagues();
      setLeagues(data);
    } catch {
      // handle error
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadLeagues();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeagues();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('CreateLeague')}>
          <Text style={styles.actionText}>Create League</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={() => navigation.navigate('JoinLeague')}
        >
          <Text style={[styles.actionText, styles.secondaryText]}>Join League</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={leagues}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.leagueCard}
            onPress={() => navigation.navigate('LeagueDetail', { leagueId: item._id })}
          >
            <Text style={styles.leagueName}>{item.name}</Text>
            <Text style={styles.leagueInfo}>{item.members.length} members</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No leagues yet.</Text>
            <Text style={styles.emptySubtext}>Create or join a league to compete with friends!</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  actions: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm },
  actionButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  secondaryButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
  actionText: { color: '#fff', fontWeight: '600', fontSize: fontSize.sm },
  secondaryText: { color: colors.primary },
  list: { padding: spacing.md },
  leagueCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  leagueName: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  leagueInfo: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
  empty: { alignItems: 'center', paddingTop: spacing.xxl },
  emptyText: { fontSize: fontSize.md, color: colors.textSecondary, fontWeight: '600' },
  emptySubtext: { fontSize: fontSize.sm, color: colors.textLight, marginTop: spacing.xs },
});

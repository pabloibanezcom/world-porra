import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { fetchMyLeagues } from '../api/leagues';
import { League } from '../types';
import { useAuthStore } from '../store/authStore';
import LeagueCard from '../components/LeagueCard';
import LoadingView from '../components/ui/LoadingView';
import { colors, fonts } from '../theme';

export default function LeaguesScreen() {
  const user = useAuthStore((s) => s.user);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation<any>();

  const loadLeagues = async () => {
    try {
      const data = await fetchMyLeagues();
      setLeagues(data);
    } catch {
      // handle error
    } finally {
      setLoading(false);
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Leagues</Text>
      </View>

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

      {loading ? (
        <LoadingView />
      ) : (
        <FlatList
          data={leagues}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <LeagueCard
              league={item}
              userId={user?.id}
              onPress={() => navigation.navigate('LeagueDetail', { leagueId: item._id })}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No leagues yet.</Text>
              <Text style={styles.emptySubtext}>Create or join a league to compete with friends!</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  titleRow: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 12 },
  title: { color: colors.text, fontSize: 30, fontFamily: fonts.display },

  actions: { flexDirection: 'row', paddingHorizontal: 18, paddingBottom: 12, gap: 10 },
  actionButton: {
    flex: 1,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderMid,
  },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 13, fontFamily: fonts.bodyMedium },
  secondaryText: { color: colors.text },

  list: { padding: 18, paddingTop: 4, gap: 10 },

  empty: { alignItems: 'center', paddingTop: 48 },
  emptyText: { color: colors.muted, fontSize: 16, fontWeight: '600', fontFamily: fonts.bodyMedium },
  emptySubtext: { color: colors.dim, fontSize: 13, marginTop: 4, fontFamily: fonts.body },
});

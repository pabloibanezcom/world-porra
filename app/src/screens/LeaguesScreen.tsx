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
import { useI18n } from '../i18n';

export default function LeaguesScreen() {
  const { t } = useI18n();
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
        <Text style={styles.title}>{t('nav.leagues')}</Text>
        <Text style={styles.subtitle}>
          {leagues.length > 0 ? t('leagues.privatePools', { count: leagues.length }) : t('leagues.joinPrivatePool')}
        </Text>
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
          ListFooterComponent={
            <TouchableOpacity style={styles.joinButton} onPress={() => navigation.navigate('JoinLeague')}>
              <Text style={styles.joinButtonText}>{t('leagues.joinLeague')}</Text>
            </TouchableOpacity>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('leagues.noLeagues')}</Text>
              <Text style={styles.emptySubtext}>{t('leagues.emptyHint')}</Text>
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
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 2, fontFamily: fonts.body },

  joinButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderMid,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  joinButtonText: { color: colors.text, fontWeight: '600', fontSize: 13, fontFamily: fonts.bodyMedium },

  list: { padding: 18, paddingTop: 4, gap: 10 },

  empty: { alignItems: 'center', paddingTop: 48 },
  emptyText: { color: colors.muted, fontSize: 16, fontWeight: '600', fontFamily: fonts.bodyMedium },
  emptySubtext: { color: colors.dim, fontSize: 13, marginTop: 4, fontFamily: fonts.body },
});

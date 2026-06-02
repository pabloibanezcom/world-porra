import React, { useState, useCallback } from 'react';
import { Alert, View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { fetchMyLeagues, updateLeagueOrder } from '../api/leagues';
import { fetchPollConfig, PollConfig } from '../api/config';
import { League } from '../types';
import { useAuthStore } from '../store/authStore';
import LeagueCard from '../components/LeagueCard';
import LoadingView from '../components/ui/LoadingView';
import JoinLeagueSheet from '../components/JoinLeagueSheet';
import { colors, fonts } from '../theme';
import { useI18n } from '../i18n';

export default function LeaguesScreen() {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [pollConfig, setPollConfig] = useState<PollConfig | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joinSheetVisible, setJoinSheetVisible] = useState(false);
  const [sortMode, setSortMode] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const navigation = useNavigation<any>();
  const ownsLeague = leagues.some((league) => {
    const owner = league.ownerId as League['ownerId'] | string | null | undefined;
    const ownerId = typeof owner === 'string' ? owner : owner?.id ?? owner?._id;
    return ownerId === user?.id;
  });
  const canCreateLeagues = !!user?.id && !ownsLeague && !pollConfig?.leagueCreationLocked;

  const loadLeagues = async () => {
    try {
      const [data, config] = await Promise.all([
        fetchMyLeagues(),
        fetchPollConfig(),
      ]);
      setLeagues(data);
      setPollConfig(config);
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

  const moveLeague = async (fromIndex: number, direction: -1 | 1) => {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= leagues.length || savingOrder) return;

    const previous = leagues;
    const next = [...leagues];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setLeagues(next);
    setSavingOrder(true);
    try {
      const savedLeagues = await updateLeagueOrder(next.map((league) => league._id));
      setLeagues(savedLeagues);
    } catch {
      setLeagues(previous);
      Alert.alert(t('common.error'), t('leagues.sortFailed'));
    } finally {
      setSavingOrder(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.titleRow}>
        <View style={styles.titleTextBlock}>
          <Text style={styles.title}>{t('nav.leagues')}</Text>
          <Text style={styles.subtitle}>
            {leagues.length > 0 ? t('leagues.privatePools', { count: leagues.length }) : t('leagues.joinPrivatePool')}
          </Text>
        </View>
        {leagues.length > 1 && (
          <TouchableOpacity style={styles.sortButton} onPress={() => setSortMode((value) => !value)}>
            <Ionicons name={sortMode ? 'checkmark' : 'swap-vertical'} size={16} color={colors.text} />
            <Text style={styles.sortButtonText}>{sortMode ? t('common.done') : t('leagues.sort')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <LoadingView />
      ) : (
        <FlatList
          data={leagues}
          keyExtractor={(item) => item._id}
          renderItem={({ item, index }) => (
            <View style={styles.leagueRow}>
              <View style={styles.leagueCardWrap}>
                <LeagueCard
                  league={item}
                  userId={user?.id}
                  onPress={sortMode ? undefined : () => navigation.navigate('LeagueDetail', { leagueId: item._id })}
                />
              </View>
              {sortMode && (
                <View style={styles.reorderControls}>
                  <TouchableOpacity
                    style={[styles.reorderButton, index === 0 && styles.reorderButtonDisabled]}
                    onPress={() => moveLeague(index, -1)}
                    disabled={index === 0 || savingOrder}
                  >
                    <Ionicons name="chevron-up" size={18} color={index === 0 ? colors.dim : colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.reorderButton, index === leagues.length - 1 && styles.reorderButtonDisabled]}
                    onPress={() => moveLeague(index, 1)}
                    disabled={index === leagues.length - 1 || savingOrder}
                  >
                    <Ionicons name="chevron-down" size={18} color={index === leagues.length - 1 ? colors.dim : colors.text} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          ListFooterComponent={
            <View style={styles.actions}>
              {canCreateLeagues && (
                <TouchableOpacity style={styles.createButton} onPress={() => navigation.navigate('CreateLeague')}>
                  <Text style={styles.createButtonText}>{t('leagues.createLeague')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.joinButton} onPress={() => setJoinSheetVisible(true)}>
                <Text style={styles.joinButtonText}>{t('leagues.joinLeague')}</Text>
              </TouchableOpacity>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('leagues.noLeagues')}</Text>
              <Text style={styles.emptySubtext}>{t('leagues.emptyHint')}</Text>
            </View>
          }
        />
      )}
      <JoinLeagueSheet
        visible={joinSheetVisible}
        onClose={() => setJoinSheetVisible(false)}
        onJoined={(league) => {
          setJoinSheetVisible(false);
          navigation.navigate('LeagueDetail', { leagueId: league._id });
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  titleRow: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  titleTextBlock: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 30, fontFamily: fonts.display },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 2, fontFamily: fonts.body },
  sortButton: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderMid,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sortButtonText: { color: colors.text, fontSize: 12, fontFamily: fonts.bodyMedium, fontWeight: '700' },

  actions: { gap: 10, marginTop: 14 },
  createButton: {
    backgroundColor: colors.accent,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  createButtonText: { color: '#fff', fontWeight: '700', fontSize: 13, fontFamily: fonts.bodyMedium },
  joinButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderMid,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  joinButtonText: { color: colors.text, fontWeight: '600', fontSize: 13, fontFamily: fonts.bodyMedium },

  list: { padding: 18, paddingTop: 4, gap: 10 },
  leagueRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  leagueCardWrap: { flex: 1, minWidth: 0 },
  reorderControls: { gap: 8, justifyContent: 'center' },
  reorderButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderMid,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderButtonDisabled: { opacity: 0.45 },

  empty: { alignItems: 'center', paddingTop: 48 },
  emptyText: { color: colors.muted, fontSize: 16, fontWeight: '600', fontFamily: fonts.bodyMedium },
  emptySubtext: { color: colors.dim, fontSize: 13, marginTop: 4, fontFamily: fonts.body },
});

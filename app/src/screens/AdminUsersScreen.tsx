import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { fetchAdminUsers, notifyAdminUsers } from '../api/admin';
import { AdminUserSummary } from '../types';
import Avatar from '../components/ui/Avatar';
import NotifyModal from '../components/NotifyModal';
import { colors, fonts } from '../theme';
import { useI18n } from '../i18n';

type SortKey = 'created' | 'points' | 'device' | 'completion';
type DeviceFilter = 'all' | 'pwa' | 'web';
type CompletionFilter = 'all' | 'complete' | 'incomplete';

function completionPercent(user: AdminUserSummary): number {
  const completion = user.predictionCompletion;
  const made = completion.matchesMade + completion.groupsMade + completion.tournamentMade;
  const total = completion.matchesTotal + completion.groupsTotal + completion.tournamentTotal;
  return total > 0 ? made / total : 0;
}

function deviceLabel(user: AdminUserSummary): string {
  if (user.device.kind === 'pwa') return 'PWA';
  if (user.device.kind === 'web') return 'Web';
  return 'No device';
}

export default function AdminUsersScreen() {
  const navigation = useNavigation<any>();
  const { t } = useI18n();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('created');
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilter>('all');
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('all');
  const [notifyVisible, setNotifyVisible] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchAdminUsers(search.trim() || undefined);
      setUsers(response.users);
      setTotalUsers(response.total);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        loadUsers().catch(() => setLoading(false));
      }, 250);
      return () => clearTimeout(timer);
    }, [loadUsers])
  );

  const orphanCount = useMemo(() => users.filter((user) => user.leagueCount === 0).length, [users]);
  const visibleUsers = useMemo(() => {
    const filtered = users.filter((user) => {
      const matchesDevice =
        deviceFilter === 'all' ||
        (deviceFilter === 'pwa' && user.device.kind === 'pwa') ||
        (deviceFilter === 'web' && user.device.kind === 'web');
      const matchesCompletion =
        completionFilter === 'all' ||
        (completionFilter === 'complete' && user.predictionCompletion.complete) ||
        (completionFilter === 'incomplete' && !user.predictionCompletion.complete);
      return matchesDevice && matchesCompletion;
    });

    return [...filtered].sort((a, b) => {
      if (sortKey === 'points') return b.totalPoints - a.totalPoints;
      if (sortKey === 'completion') return completionPercent(b) - completionPercent(a);
      if (sortKey === 'device') return deviceLabel(a).localeCompare(deviceLabel(b));
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [completionFilter, deviceFilter, sortKey, users]);

  const notifyFilteredUsers = async (title: string, body: string) => {
    const recipients = visibleUsers.map((user) => user.id);
    const response = await notifyAdminUsers(recipients, title, body);
    Alert.alert(t('adminUsers.notifySentTitle'), t('adminUsers.notifySentBody', { count: response.recipients }));
  };

  const openUser = (user: AdminUserSummary) => {
    navigation.navigate('MemberScreen', {
      source: 'admin',
      userId: user.id,
      memberName: user.name,
      memberAvatarUrl: user.avatarUrl,
      memberColor: user.leagueCount === 0 ? colors.warning : colors.blue,
      memberPoints: user.totalPoints,
      backLabel: t('adminUsers.title'),
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.muted} />
          <Text style={styles.backText}>{t('profile.admin')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('adminUsers.title')}</Text>
        <Text style={styles.subtitle}>{t('adminUsers.subtitle', { count: totalUsers, orphans: orphanCount })}</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={14} color={colors.dim} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t('adminUsers.search')}
          placeholderTextColor={colors.dim}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={colors.dim} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.controls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <FilterChip label={t('adminUsers.sortRecent')} selected={sortKey === 'created'} onPress={() => setSortKey('created')} />
          <FilterChip label={t('adminUsers.sortPoints')} selected={sortKey === 'points'} onPress={() => setSortKey('points')} />
          <FilterChip label={t('adminUsers.sortDevice')} selected={sortKey === 'device'} onPress={() => setSortKey('device')} />
          <FilterChip label={t('adminUsers.sortCompletion')} selected={sortKey === 'completion'} onPress={() => setSortKey('completion')} />
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <FilterChip label={t('adminUsers.filterAllDevices')} selected={deviceFilter === 'all'} onPress={() => setDeviceFilter('all')} />
          <FilterChip label={t('adminUsers.filterPwa')} selected={deviceFilter === 'pwa'} onPress={() => setDeviceFilter('pwa')} />
          <FilterChip label={t('adminUsers.filterWeb')} selected={deviceFilter === 'web'} onPress={() => setDeviceFilter('web')} />
          <FilterChip label={t('adminUsers.filterAllPredictions')} selected={completionFilter === 'all'} onPress={() => setCompletionFilter('all')} />
          <FilterChip label={t('adminUsers.filterIncomplete')} selected={completionFilter === 'incomplete'} onPress={() => setCompletionFilter('incomplete')} />
          <FilterChip label={t('adminUsers.filterComplete')} selected={completionFilter === 'complete'} onPress={() => setCompletionFilter('complete')} />
        </ScrollView>
        <View style={styles.resultActionRow}>
          <Text style={styles.resultCount}>{t('adminUsers.filteredCount', { count: visibleUsers.length })}</Text>
          <TouchableOpacity
            style={[styles.notifyBtn, visibleUsers.length === 0 && styles.notifyBtnDisabled]}
            onPress={() => setNotifyVisible(true)}
            disabled={visibleUsers.length === 0}
            activeOpacity={0.8}
          >
            <Ionicons name="notifications-outline" size={15} color={colors.text} />
            <Text style={styles.notifyBtnText}>{t('adminUsers.notifyFiltered')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {visibleUsers.map((user) => {
            const completion = user.predictionCompletion;
            const complete = completion.complete;
            return (
            <TouchableOpacity key={user.id} style={styles.userCard} onPress={() => openUser(user)} activeOpacity={0.85}>
              <Avatar name={user.name} color={user.leagueCount === 0 ? colors.warning : colors.blue} imageUrl={user.avatarUrl} size={42} />
              <View style={styles.userMain}>
                <View style={styles.userNameRow}>
                  <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
                  {user.isMaster && <Text style={styles.masterPill}>{t('common.admin')}</Text>}
                </View>
                <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
                <Text style={styles.userMeta}>
                  {user.leagueCount === 0
                    ? t('adminUsers.noLeagues')
                    : t('adminUsers.leaguesCount', { count: user.leagueCount })}
                  {' · '}
                  {t('adminUsers.predictionsCount', { count: user.predictionCount })}
                </Text>
                <View style={styles.statusRow}>
                  <InfoChip label={deviceLabel(user)} tone={user.device.kind === 'pwa' ? 'ok' : user.device.kind === 'none' ? 'warn' : 'neutral'} />
                  <InfoChip
                    label={complete ? t('adminUsers.predictionsComplete') : t('adminUsers.predictionsIncomplete')}
                    tone={complete ? 'ok' : 'warn'}
                  />
                </View>
                <View style={styles.predictionGrid}>
                  <ProgressStat label={t('adminUsers.matchesShort')} value={`${completion.matchesMade}/${completion.matchesTotal}`} />
                  <ProgressStat label={t('adminUsers.groupsShort')} value={`${completion.groupsMade}/${completion.groupsTotal}`} />
                  <ProgressStat label={t('adminUsers.finalsShort')} value={`${completion.tournamentMade}/${completion.tournamentTotal}`} />
                </View>
              </View>
              <View style={styles.pointsBlock}>
                <Text style={styles.points}>{user.totalPoints}</Text>
                <Text style={styles.pointsLabel}>{t('common.pointsShort')}</Text>
              </View>
            </TouchableOpacity>
            );
          })}
          {visibleUsers.length === 0 && <Text style={styles.empty}>{t('adminUsers.empty')}</Text>}
        </ScrollView>
      )}

      <NotifyModal
        visible={notifyVisible}
        title={t('adminUsers.notifyFilteredTitle', { count: visibleUsers.length })}
        onClose={() => setNotifyVisible(false)}
        onSend={notifyFilteredUsers}
      />
    </SafeAreaView>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.filterChip, selected && styles.filterChipSelected]} onPress={onPress} activeOpacity={0.75}>
      <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function InfoChip({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'neutral' }) {
  return (
    <Text style={[styles.infoChip, tone === 'ok' && styles.infoChipOk, tone === 'warn' && styles.infoChipWarn]}>
      {label}
    </Text>
  );
}

function ProgressStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.progressStat}>
      <Text style={styles.progressValue}>{value}</Text>
      <Text style={styles.progressLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginBottom: 14 },
  backText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 13 },
  title: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginTop: 4 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 18,
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 14, padding: 0 },
  controls: { marginHorizontal: 18, marginBottom: 12, gap: 8 },
  chipRow: { gap: 8, paddingRight: 18 },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  filterChipSelected: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  filterChipText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 11, fontWeight: '700' },
  filterChipTextSelected: { color: colors.accent },
  resultActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  resultCount: { color: colors.dim, fontFamily: fonts.body, fontSize: 12 },
  notifyBtn: {
    borderRadius: 999,
    backgroundColor: colors.blue,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  notifyBtnDisabled: { opacity: 0.45 },
  notifyBtnText: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 12, fontWeight: '700' },
  list: { padding: 18, paddingTop: 0, paddingBottom: 28, gap: 10 },
  userCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userMain: { flex: 1, minWidth: 0 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userName: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  masterPill: {
    color: colors.accent,
    backgroundColor: colors.accentDim,
    borderRadius: 8,
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    fontWeight: '700',
  },
  userEmail: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  userMeta: { color: colors.dim, fontFamily: fonts.body, fontSize: 11, marginTop: 4 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  infoChip: {
    color: colors.muted,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    fontWeight: '700',
  },
  infoChipOk: { color: colors.accent, backgroundColor: colors.accentDim },
  infoChipWarn: { color: colors.warning, backgroundColor: 'rgba(236,126,0,0.14)' },
  predictionGrid: { flexDirection: 'row', gap: 7, marginTop: 8 },
  progressStat: {
    minWidth: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 7,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  progressValue: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 12, fontWeight: '700' },
  progressLabel: { color: colors.dim, fontFamily: fonts.body, fontSize: 9, marginTop: 1 },
  pointsBlock: { alignItems: 'flex-end', minWidth: 44 },
  points: { color: colors.accent, fontFamily: fonts.bodyMedium, fontSize: 17, fontWeight: '700' },
  pointsLabel: { color: colors.dim, fontFamily: fonts.body, fontSize: 10 },
  empty: { color: colors.muted, fontFamily: fonts.body, textAlign: 'center', marginTop: 36 },
});

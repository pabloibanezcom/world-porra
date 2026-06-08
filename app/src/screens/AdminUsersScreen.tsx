import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { fetchAdminUsers } from '../api/admin';
import { AdminUserSummary } from '../types';
import Avatar from '../components/ui/Avatar';
import { colors, fonts } from '../theme';
import { useI18n } from '../i18n';

export default function AdminUsersScreen() {
  const navigation = useNavigation<any>();
  const { t } = useI18n();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

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

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {users.map((user) => (
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
              </View>
              <View style={styles.pointsBlock}>
                <Text style={styles.points}>{user.totalPoints}</Text>
                <Text style={styles.pointsLabel}>{t('common.pointsShort')}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {users.length === 0 && <Text style={styles.empty}>{t('adminUsers.empty')}</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
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
  pointsBlock: { alignItems: 'flex-end', minWidth: 44 },
  points: { color: colors.accent, fontFamily: fonts.bodyMedium, fontSize: 17, fontWeight: '700' },
  pointsLabel: { color: colors.dim, fontFamily: fonts.body, fontSize: 10 },
  empty: { color: colors.muted, fontFamily: fonts.body, textAlign: 'center', marginTop: 36 },
});

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { deleteAdminUser, fetchAdminUserDetail, fetchAdminUsers } from '../api/admin';
import { AdminUserDetail, AdminUserSummary } from '../types';
import Avatar from '../components/ui/Avatar';
import Flag from '../components/ui/Flag';
import { colors, fonts } from '../theme';
import { useI18n } from '../i18n';
import { getApiErrorMessage } from '../utils/apiError';
import { useAuthStore } from '../store/authStore';

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children.toUpperCase()}</Text>;
}

function formatDate(value: string, locale: string): string {
  return new Date(value).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDeviceLastSeen(value: string, locale: string): string {
  return new Date(value).toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function summarizeUserAgent(userAgent: string): string {
  if (!userAgent) return '';
  if (/Edg\//.test(userAgent)) return 'Edge';
  if (/CriOS|Chrome\//.test(userAgent)) return 'Chrome';
  if (/Firefox\//.test(userAgent)) return 'Firefox';
  if (/Safari\//.test(userAgent)) return 'Safari';
  return userAgent.slice(0, 42);
}

export default function AdminUsersScreen() {
  const navigation = useNavigation();
  const { t, locale } = useI18n();
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [selected, setSelected] = useState<AdminUserDetail | null>(null);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers().catch(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [loadUsers]);

  const orphanCount = useMemo(() => users.filter((user) => user.leagueCount === 0).length, [users]);
  const deleteConfirmationMatches = !!selected && deleteConfirmation.trim() === selected.user.email;
  const isSelectedCurrentUser = !!selected && selected.user.id === currentUser?.id;

  const openUser = async (userId: string) => {
    setDetailLoading(true);
    try {
      setDeleteConfirmation('');
      setSelected(await fetchAdminUserDetail(userId));
    } finally {
      setDetailLoading(false);
    }
  };

  const closeUser = () => {
    setSelected(null);
    setDeleteConfirmation('');
  };

  const onDeleteSelectedUser = async () => {
    if (!selected || !deleteConfirmationMatches || deletingUser) return;

    setDeletingUser(true);
    try {
      await deleteAdminUser(selected.user.id, deleteConfirmation.trim());
      setSelected(null);
      setDeleteConfirmation('');
      await loadUsers();
    } catch (err) {
      Alert.alert(t('common.error'), getApiErrorMessage(err, t('adminUsers.deleteFailed')));
    } finally {
      setDeletingUser(false);
    }
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
            <TouchableOpacity key={user.id} style={styles.userCard} onPress={() => openUser(user.id)} activeOpacity={0.85}>
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

      {detailLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={closeUser}>
        <View style={styles.modalBackdrop}>
          {selected && (
            <View style={styles.detailPanel}>
              <View style={styles.detailHeader}>
                <View style={styles.detailIdentity}>
                  <Avatar
                    name={selected.user.name}
                    color={selected.user.leagueCount === 0 ? colors.warning : colors.blue}
                    imageUrl={selected.user.avatarUrl}
                    size={52}
                  />
                  <View style={styles.detailNameBlock}>
                    <Text style={styles.detailName} numberOfLines={1}>{selected.user.name}</Text>
                    <Text style={styles.detailEmail} numberOfLines={1}>{selected.user.email}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={closeUser}>
                  <Ionicons name="close" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.statsRow}>
                  <Stat label={t('common.points')} value={`${selected.user.totalPoints}`} color={colors.accent} />
                  <Stat label={t('adminUsers.leagues')} value={`${selected.user.leagueCount}`} color={colors.text} />
                  <Stat label={t('adminUsers.picks')} value={`${selected.predictions.total}`} color={colors.blue} />
                </View>

                <View>
                  <SectionLabel>{t('adminUsers.account')}</SectionLabel>
                  <View style={styles.infoCard}>
                    <InfoRow label={t('adminUsers.created')} value={formatDate(selected.user.createdAt, locale)} />
                    <InfoRow label={t('adminUsers.updated')} value={formatDate(selected.user.updatedAt, locale)} />
                    <InfoRow label={t('adminUsers.groupPicks')} value={`${selected.user.groupPredictionCount}`} />
                    <InfoRow label={t('adminUsers.tournamentPicks')} value={selected.user.hasTournamentPrediction ? t('common.done') : t('common.missing')} />
                  </View>
                </View>

                <View>
                  <SectionLabel>{t('adminUsers.devices')}</SectionLabel>
                  <View style={styles.infoCard}>
                    {selected.devices.length === 0 ? (
                      <Text style={styles.cardEmpty}>{t('adminUsers.noDevices')}</Text>
                    ) : (
                      selected.devices.map((device) => (
                        <View key={device._id} style={styles.deviceRow}>
                          <View style={styles.deviceTextBlock}>
                            <View style={styles.deviceTitleRow}>
                              <Text style={styles.deviceTitle}>
                                {device.displayMode === 'standalone' ? t('adminUsers.pwa') : t('adminUsers.browser')}
                              </Text>
                              <Text style={[styles.statusPill, device.displayMode === 'standalone' && styles.statusPillOk]}>
                                {device.platform.toUpperCase()}
                              </Text>
                            </View>
                            <Text style={styles.deviceMeta}>
                              {[
                                summarizeUserAgent(device.userAgent),
                                device.browserLanguage,
                                t('adminUsers.lastSeen', { date: formatDeviceLastSeen(device.lastSeenAt, locale) }),
                              ].filter(Boolean).join(' · ')}
                            </Text>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                </View>

                <View>
                  <SectionLabel>{t('adminUsers.leagues')}</SectionLabel>
                  <View style={styles.infoCard}>
                    {selected.user.leagues.length === 0 ? (
                      <Text style={styles.cardEmpty}>{t('adminUsers.noLeagues')}</Text>
                    ) : (
                      selected.user.leagues.map((league) => (
                        <View key={league._id} style={styles.leagueRow}>
                          <View style={styles.leagueTextBlock}>
                            <Text style={styles.leagueName}>{league.name}</Text>
                            <Text style={styles.leagueMeta}>{league.inviteCode} · {formatDate(league.joinedAt, locale)}</Text>
                          </View>
                          <Text style={[styles.statusPill, league.hasPaid && styles.statusPillOk]}>
                            {league.isAdmin ? t('common.admin') : league.hasPaid ? t('payments.paid') : t('common.member')}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>

                <View>
                  <SectionLabel>{t('adminUsers.recentPicks')}</SectionLabel>
                  <View style={styles.infoCard}>
                    {selected.predictions.recent.length === 0 ? (
                      <Text style={styles.cardEmpty}>{t('adminUsers.noPicks')}</Text>
                    ) : (
                      selected.predictions.recent.map((prediction) => (
                        <View key={prediction._id} style={styles.pickRow}>
                          <View style={styles.pickTeams}>
                            {prediction.match ? (
                              <>
                                <Flag code={prediction.match.homeTeam.code} size={18} />
                                <Text style={styles.pickText} numberOfLines={1}>
                                  {prediction.match.homeTeam.name}{' '}
                                  {prediction.isRevealed
                                    ? `${prediction.homeGoals}-${prediction.awayGoals}`
                                    : t('common.vs')}{' '}
                                  {prediction.match.awayTeam.name}
                                </Text>
                                <Flag code={prediction.match.awayTeam.code} size={18} />
                              </>
                            ) : (
                              <Text style={styles.pickText}>{t('adminUsers.matchPick')}</Text>
                            )}
                          </View>
                          <Text style={styles.pickPoints}>
                            {prediction.isRevealed
                              ? `${prediction.points ?? '—'} ${t('common.pointsShort')}`
                              : prediction.hasPrediction ? t('adminUsers.made') : t('common.missing')}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>

                <View>
                  <SectionLabel>{t('adminUsers.groupPicks')}</SectionLabel>
                  <View style={styles.infoCard}>
                    {selected.groupPredictions.length === 0 ? (
                      <Text style={styles.cardEmpty}>{t('common.missing')}</Text>
                    ) : (
                      selected.groupPredictions.map((prediction) => (
                        <InfoRow
                          key={prediction._id}
                          label={t('common.group', { group: prediction.group })}
                          value={
                            prediction.isRevealed
                              ? `${prediction.orderedTeamCodes?.join(', ') ?? t('common.missing')} · ${prediction.points ?? '—'} ${t('common.pointsShort')}`
                              : prediction.hasPrediction ? t('adminUsers.made') : t('common.missing')
                          }
                        />
                      ))
                    )}
                  </View>
                </View>

                <View>
                  <SectionLabel>{t('tournament.picks')}</SectionLabel>
                  <View style={styles.infoCard}>
                    {selected.tournamentPrediction ? (
                      <InfoRow
                        label={t('adminUsers.status')}
                        value={selected.tournamentPrediction.hasPrediction ? t('adminUsers.made') : t('common.missing')}
                      />
                    ) : (
                      <Text style={styles.cardEmpty}>{t('adminUsers.noTournamentPicks')}</Text>
                    )}
                  </View>
                </View>

                <View>
                  <SectionLabel>{t('adminUsers.dangerZone')}</SectionLabel>
                  <View style={[styles.infoCard, styles.dangerCard]}>
                    <Text style={styles.dangerTitle}>{t('adminUsers.deleteTitle')}</Text>
                    <Text style={styles.dangerBody}>
                      {t('adminUsers.deleteBody', {
                        email: selected.user.email,
                        leagues: selected.user.leagueCount,
                        picks: selected.predictions.total + selected.user.groupPredictionCount + (selected.user.hasTournamentPrediction ? 1 : 0),
                      })}
                    </Text>
                    {isSelectedCurrentUser ? (
                      <Text style={styles.selfDeleteBlocked}>{t('adminUsers.deleteSelfBlocked')}</Text>
                    ) : (
                      <>
                        <Text style={styles.deleteInputLabel}>{t('adminUsers.deleteInputLabel', { email: selected.user.email })}</Text>
                        <TextInput
                          style={styles.deleteInput}
                          value={deleteConfirmation}
                          onChangeText={setDeleteConfirmation}
                          placeholder={selected.user.email}
                          placeholderTextColor={colors.dim}
                          autoCapitalize="none"
                          autoCorrect={false}
                          keyboardType="email-address"
                        />
                        <TouchableOpacity
                          style={[styles.deleteUserBtn, (!deleteConfirmationMatches || deletingUser) && styles.deleteUserBtnDisabled]}
                          onPress={onDeleteSelectedUser}
                          disabled={!deleteConfirmationMatches || deletingUser}
                          activeOpacity={0.85}
                        >
                          {deletingUser ? (
                            <ActivityIndicator color={colors.text} size="small" />
                          ) : (
                            <>
                              <Ionicons name="trash-outline" size={16} color={colors.text} />
                              <Text style={styles.deleteUserBtnText}>{t('adminUsers.deleteAction')}</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </>
                      )}
                  </View>
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,17,21,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.62)' },
  detailPanel: {
    maxHeight: '88%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  detailHeader: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  detailIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  detailNameBlock: { flex: 1, minWidth: 0 },
  detailName: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 22, fontWeight: '700' },
  detailEmail: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailScroll: { padding: 18, paddingBottom: 28, gap: 18 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    alignItems: 'center',
  },
  statValue: { fontFamily: fonts.bodyMedium, fontSize: 18, fontWeight: '700' },
  statLabel: { color: colors.dim, fontFamily: fonts.body, fontSize: 10, marginTop: 3, textAlign: 'center' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.dim,
    letterSpacing: 1.2,
    marginBottom: 8,
    fontFamily: fonts.bodyMedium,
  },
  infoCard: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  infoRow: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  infoValue: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 12, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  cardEmpty: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, padding: 14 },
  leagueRow: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  leagueTextBlock: { flex: 1, minWidth: 0 },
  leagueName: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 13, fontWeight: '700' },
  leagueMeta: { color: colors.dim, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  deviceRow: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  deviceTextBlock: { minWidth: 0 },
  deviceTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  deviceTitle: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 13, fontWeight: '700' },
  deviceMeta: { color: colors.dim, fontFamily: fonts.body, fontSize: 11, marginTop: 4 },
  statusPill: {
    color: colors.muted,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    fontWeight: '700',
  },
  statusPillOk: { color: colors.accent, backgroundColor: colors.accentDim },
  pickRow: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pickTeams: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  pickText: { color: colors.text, fontFamily: fonts.body, fontSize: 12, flexShrink: 1 },
  pickPoints: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 12, fontWeight: '700' },
  dangerCard: { padding: 14, gap: 10 },
  dangerTitle: { color: colors.danger, fontFamily: fonts.bodyMedium, fontSize: 14, fontWeight: '700' },
  dangerBody: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  selfDeleteBlocked: { color: colors.warning, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 18 },
  deleteInputLabel: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 12, fontWeight: '700' },
  deleteInput: {
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  deleteUserBtn: {
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: colors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteUserBtnDisabled: { opacity: 0.45 },
  deleteUserBtnText: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 13, fontWeight: '700' },
});

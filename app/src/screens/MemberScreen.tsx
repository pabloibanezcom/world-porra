import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { fetchMemberPredictions, MemberMatchPrediction, MemberUpcomingMatch } from '../api/leagues';
import { deleteAdminUser, fetchAdminUserDetail } from '../api/admin';
import { AdminUserDetail } from '../types';
import { colors, fonts } from '../theme';
import Avatar from '../components/ui/Avatar';
import Flag from '../components/ui/Flag';
import NotifyModal from '../components/NotifyModal';
import { notifyLeagueMembers } from '../api/leagues';
import { useI18n } from '../i18n';
import { useAuthStore } from '../store/authStore';
import { getApiErrorMessage } from '../utils/apiError';

type RouteParams = {
  MemberScreen: {
    source?: 'league' | 'admin';
    leagueId?: string;
    leagueName?: string;
    memberId?: string;
    userId?: string;
    memberName?: string;
    memberColor?: string;
    memberAvatarUrl?: string;
    memberPoints?: number;
    memberRank?: number;
    totalMembers?: number;
    isAdmin?: boolean;
    isMe?: boolean;
    backLabel?: string;
  };
};

function getResult(
  pred: { homeGoals: number; awayGoals: number },
  result: { homeGoals: number; awayGoals: number }
): 'exact' | 'correct' | 'wrong' {
  if (pred.homeGoals === result.homeGoals && pred.awayGoals === result.awayGoals) return 'exact';
  const pOut = pred.homeGoals > pred.awayGoals ? 'h' : pred.homeGoals < pred.awayGoals ? 'a' : 'd';
  const aOut = result.homeGoals > result.awayGoals ? 'h' : result.homeGoals < result.awayGoals ? 'a' : 'd';
  return pOut === aOut ? 'correct' : 'wrong';
}

function ResultBadge({ result }: { result: 'exact' | 'correct' | 'wrong' }) {
  const { t } = useI18n();
  const cfg = {
    exact: { label: t('member.exact'), bg: colors.accentDim, color: colors.accent },
    correct: { label: t('member.correct'), bg: colors.blueDim, color: colors.blue },
    wrong: { label: t('member.wrong'), bg: 'rgba(226,59,74,0.12)', color: colors.danger },
  }[result];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children.toUpperCase()}</Text>;
}

function formatDate(value: string, locale: string): string {
  return new Date(value).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDeviceLastSeen(value: string, locale: string): string {
  return new Date(value).toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatMatchDate(utcDate: string, locale: string): string {
  return new Date(utcDate).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function summarizeUserAgent(userAgent: string): string {
  if (!userAgent) return '';
  if (/Edg\//.test(userAgent)) return 'Edge';
  if (/CriOS|Chrome\//.test(userAgent)) return 'Chrome';
  if (/Firefox\//.test(userAgent)) return 'Firefox';
  if (/Safari\//.test(userAgent)) return 'Safari';
  return userAgent.slice(0, 42);
}

export default function MemberScreen() {
  const { language, locale, t } = useI18n();
  const route = useRoute<RouteProp<RouteParams, 'MemberScreen'>>();
  const navigation = useNavigation<any>();
  const currentUser = useAuthStore((s) => s.user);
  const params = route.params;
  const targetUserId = params.userId ?? params.memberId;
  const hasLeagueContext = !!params.leagueId && !!params.memberId;

  const [finishedMatches, setFinishedMatches] = useState<MemberMatchPrediction[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<MemberUpcomingMatch[]>([]);
  const [leagueLoading, setLeagueLoading] = useState(hasLeagueContext);
  const [adminDetail, setAdminDetail] = useState<AdminUserDetail | null>(null);
  const [adminLoading, setAdminLoading] = useState(!!currentUser?.isMaster && !!targetUserId);
  const [notifyVisible, setNotifyVisible] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const loadLeagueDetail = useCallback(async () => {
    if (!params.leagueId || !params.memberId) {
      setLeagueLoading(false);
      return;
    }

    setLeagueLoading(true);
    try {
      const data = await fetchMemberPredictions(params.leagueId, params.memberId);
      setFinishedMatches(data.finishedMatches);
      setUpcomingMatches(data.upcomingMatches);
    } finally {
      setLeagueLoading(false);
    }
  }, [params.leagueId, params.memberId, language]);

  const loadAdminDetail = useCallback(async () => {
    if (!currentUser?.isMaster || !targetUserId) {
      setAdminLoading(false);
      return;
    }

    setAdminLoading(true);
    try {
      setAdminDetail(await fetchAdminUserDetail(targetUserId));
    } finally {
      setAdminLoading(false);
    }
  }, [currentUser?.isMaster, targetUserId]);

  useEffect(() => {
    loadLeagueDetail().catch(() => setLeagueLoading(false));
  }, [loadLeagueDetail]);

  useEffect(() => {
    loadAdminDetail().catch(() => setAdminLoading(false));
  }, [loadAdminDetail]);

  const picksTotal = finishedMatches.length + upcomingMatches.length;
  const picksMade = finishedMatches.filter((m) => m.prediction !== null).length +
    upcomingMatches.filter((m) => m.hasPick).length;
  const pending = upcomingMatches.filter((m) => !m.hasPick).length;
  const missingUpcomingMatches = upcomingMatches.filter((m) => !m.hasPick);
  const displayName = adminDetail?.user.name ?? params.memberName ?? t('adminContact.unknownUser');
  const displayEmail = adminDetail?.user.email;
  const avatarUrl = adminDetail?.user.avatarUrl ?? params.memberAvatarUrl;
  const avatarColor = params.memberColor ?? (adminDetail?.user.leagueCount === 0 ? colors.warning : colors.blue);
  const isMe = !!params.isMe || (!!targetUserId && targetUserId === currentUser?.id);
  const backLabel = hasLeagueContext ? params.leagueName : params.backLabel ?? t('adminUsers.title');
  const deleteConfirmationMatches = !!adminDetail && deleteConfirmation.trim() === adminDetail.user.email;
  const isSelectedCurrentUser = !!adminDetail && adminDetail.user.id === currentUser?.id;
  const showGlobalRecentPicks = !!adminDetail && !hasLeagueContext;
  const pageLoading = (hasLeagueContext && leagueLoading) || (currentUser?.isMaster && adminLoading && !adminDetail);

  const onDeleteUser = async () => {
    if (!adminDetail || !deleteConfirmationMatches || deletingUser) return;

    setDeletingUser(true);
    try {
      await deleteAdminUser(adminDetail.user.id, deleteConfirmation.trim());
      navigation.goBack();
    } catch (err) {
      Alert.alert(t('common.error'), getApiErrorMessage(err, t('adminUsers.deleteFailed')));
    } finally {
      setDeletingUser(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.muted} />
          <Text style={styles.backText}>{backLabel}</Text>
        </TouchableOpacity>

        <View style={styles.heroSection}>
          <View
            style={[
              styles.avatarWrapper,
              isMe && styles.avatarWrapperMe,
            ]}
          >
            <Avatar name={displayName} color={avatarColor} imageUrl={avatarUrl} size={76} />
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>{isMe ? t('member.heroNameYou', { name: displayName }) : displayName}</Text>
            <Text style={styles.heroSub} numberOfLines={1}>
              {hasLeagueContext ? params.leagueName : displayEmail}
            </Text>
          </View>
          <View style={styles.heroBadges}>
            {hasLeagueContext && typeof params.memberRank === 'number' && (
              <View style={[styles.pill, { backgroundColor: colors.accentDim }]}>
                <Text style={[styles.pillText, { color: colors.accent }]}>{t('member.inLeague', { rank: params.memberRank })}</Text>
              </View>
            )}
            {adminDetail?.user.isMaster && (
              <View style={[styles.pill, { backgroundColor: colors.blueDim }]}>
                <Text style={[styles.pillText, { color: colors.blue }]}>{t('common.admin')}</Text>
              </View>
            )}
            <View style={[styles.pill, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
              <Text style={[styles.pillText, { color: colors.text }]}>
                {(hasLeagueContext ? params.memberPoints : adminDetail?.user.totalPoints ?? params.memberPoints) ?? 0} {t('common.pointsShort')}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          {hasLeagueContext ? (
            <>
              <StatCard label={t('member.picksMade')} value={`${picksMade}/${picksTotal}`} color={colors.text} loading={leagueLoading} />
              <StatCard label={t('member.pending')} value={`${pending}`} color={colors.warning} loading={leagueLoading} />
              <StatCard
                label={t('common.rank')}
                value={`#${params.memberRank ?? '—'}/${params.totalMembers ?? '—'}`}
                color={colors.accent}
                loading={leagueLoading}
              />
            </>
          ) : (
            <>
              <StatCard label={t('common.points')} value={`${adminDetail?.user.totalPoints ?? 0}`} color={colors.accent} loading={adminLoading} />
              <StatCard label={t('adminUsers.leagues')} value={`${adminDetail?.user.leagueCount ?? 0}`} color={colors.text} loading={adminLoading} />
              <StatCard label={t('adminUsers.picks')} value={`${adminDetail?.predictions.total ?? 0}`} color={colors.blue} loading={adminLoading} />
            </>
          )}
        </View>

        {pageLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 22 }} />
        ) : (
          <>
            {adminDetail && (
              <>
                <View>
                  <SectionLabel>{t('adminUsers.account')}</SectionLabel>
                  <View style={styles.infoCard}>
                    <InfoRow label={t('adminUsers.created')} value={formatDate(adminDetail.user.createdAt, locale)} />
                    <InfoRow label={t('adminUsers.updated')} value={formatDate(adminDetail.user.updatedAt, locale)} />
                    <InfoRow label={t('adminUsers.groupPicks')} value={`${adminDetail.user.groupPredictionCount}`} />
                    <InfoRow label={t('adminUsers.tournamentPicks')} value={adminDetail.user.hasTournamentPrediction ? t('common.done') : t('common.missing')} />
                  </View>
                </View>

                <View>
                  <SectionLabel>{t('adminUsers.devices')}</SectionLabel>
                  <View style={styles.infoCard}>
                    {adminDetail.devices.length === 0 ? (
                      <Text style={styles.cardEmpty}>{t('adminUsers.noDevices')}</Text>
                    ) : (
                      adminDetail.devices.map((device) => (
                        <View key={device._id} style={styles.deviceRow}>
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
                      ))
                    )}
                  </View>
                </View>

                <View>
                  <SectionLabel>{t('adminUsers.leagues')}</SectionLabel>
                  <View style={styles.infoCard}>
                    {adminDetail.user.leagues.length === 0 ? (
                      <Text style={styles.cardEmpty}>{t('adminUsers.noLeagues')}</Text>
                    ) : (
                      adminDetail.user.leagues.map((league) => (
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
              </>
            )}

            {hasLeagueContext && finishedMatches.length > 0 && (
              <View>
                <SectionLabel>{t('member.latestPicks')}</SectionLabel>
                <View style={styles.cardsColumn}>
                  {finishedMatches.map((m) => (
                    <FinishedMatchCard key={m._id} match={m} />
                  ))}
                </View>
              </View>
            )}

            {hasLeagueContext && missingUpcomingMatches.length > 0 && (
              <View>
                <SectionLabel>{t('member.pendingPicks')}</SectionLabel>
                <View style={styles.cardsColumn}>
                  {missingUpcomingMatches.map((m) => (
                    <PendingMatchRow key={m._id} match={m} />
                  ))}
                </View>
              </View>
            )}

            {showGlobalRecentPicks && (
              <View>
                <SectionLabel>{t('adminUsers.recentPicks')}</SectionLabel>
                <View style={styles.infoCard}>
                  {adminDetail.predictions.recent.length === 0 ? (
                    <Text style={styles.cardEmpty}>{t('adminUsers.noPicks')}</Text>
                  ) : (
                    adminDetail.predictions.recent.map((prediction) => (
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
            )}

            {adminDetail && (
              <>
                <View>
                  <SectionLabel>{t('adminUsers.groupPicks')}</SectionLabel>
                  <View style={styles.infoCard}>
                    {adminDetail.groupPredictions.length === 0 ? (
                      <Text style={styles.cardEmpty}>{t('common.missing')}</Text>
                    ) : (
                      adminDetail.groupPredictions.map((prediction) => (
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
                    {adminDetail.tournamentPrediction ? (
                      <InfoRow
                        label={t('adminUsers.status')}
                        value={adminDetail.tournamentPrediction.hasPrediction ? t('adminUsers.made') : t('common.missing')}
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
                        email: adminDetail.user.email,
                        leagues: adminDetail.user.leagueCount,
                        picks: adminDetail.predictions.total + adminDetail.user.groupPredictionCount + (adminDetail.user.hasTournamentPrediction ? 1 : 0),
                      })}
                    </Text>
                    {isSelectedCurrentUser ? (
                      <Text style={styles.selfDeleteBlocked}>{t('adminUsers.deleteSelfBlocked')}</Text>
                    ) : (
                      <>
                        <Text style={styles.deleteInputLabel}>{t('adminUsers.deleteInputLabel', { email: adminDetail.user.email })}</Text>
                        <TextInput
                          style={styles.deleteInput}
                          value={deleteConfirmation}
                          onChangeText={setDeleteConfirmation}
                          placeholder={adminDetail.user.email}
                          placeholderTextColor={colors.dim}
                          autoCapitalize="none"
                          autoCorrect={false}
                          keyboardType="email-address"
                        />
                        <TouchableOpacity
                          style={[styles.deleteUserBtn, (!deleteConfirmationMatches || deletingUser) && styles.deleteUserBtnDisabled]}
                          onPress={onDeleteUser}
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
              </>
            )}
          </>
        )}
      </ScrollView>

      {hasLeagueContext && params.isAdmin && !isMe && (
        <View style={styles.reminderBar}>
          <TouchableOpacity style={styles.reminderBtn} onPress={() => setNotifyVisible(true)} activeOpacity={0.85}>
            <Ionicons name="notifications-outline" size={18} color={colors.text} />
            <Text style={styles.reminderBtnText}>{t('member.sendReminder')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {hasLeagueContext && params.leagueId && (
        <NotifyModal
          visible={notifyVisible}
          title={t('member.remind', { name: displayName })}
          onClose={() => setNotifyVisible(false)}
          onSend={(title, body) => notifyLeagueMembers(params.leagueId!, title, body)}
        />
      )}
    </SafeAreaView>
  );
}

function StatCard({ label, value, color, loading }: { label: string; value: string; color: string; loading: boolean }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{loading ? '—' : value}</Text>
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

function FinishedMatchCard({ match }: { match: MemberMatchPrediction }) {
  const { t, locale } = useI18n();
  const result =
    match.prediction && match.result
      ? getResult(match.prediction, match.result)
      : null;

  return (
    <View style={styles.matchCard}>
      <View style={styles.matchCardHeader}>
        <Text style={styles.matchMeta}>
          {match.group ? t('common.group', { group: match.group }) : match.stage.replace(/_/g, ' ')} · {formatMatchDate(match.utcDate, locale)}
        </Text>
        {result ? <ResultBadge result={result} /> : <Text style={styles.noPick}>{t('member.noPick')}</Text>}
      </View>
      <View style={styles.matchRow}>
        <View style={styles.teamSide}>
          <Flag code={match.homeTeam.code} size={20} />
          <Text style={styles.teamName}>{match.homeTeam.name}</Text>
        </View>
        <View style={styles.scoreBlock}>
          <Text style={styles.score}>
            {match.result ? `${match.result.homeGoals} – ${match.result.awayGoals}` : '– –'}
          </Text>
          {match.prediction && (
            <Text style={styles.pickLabel}>
              {t('common.pick')}: {match.prediction.homeGoals}–{match.prediction.awayGoals}
            </Text>
          )}
        </View>
        <View style={[styles.teamSide, styles.teamSideRight]}>
          <Text style={styles.teamName}>{match.awayTeam.name}</Text>
          <Flag code={match.awayTeam.code} size={20} />
        </View>
      </View>
    </View>
  );
}

function PendingMatchRow({ match }: { match: MemberUpcomingMatch }) {
  const { t } = useI18n();
  return (
    <View style={styles.pendingRow}>
      <View style={styles.pendingTeams}>
        <Flag code={match.homeTeam.code} size={18} />
        <Text style={styles.pendingTeamText}>
          {match.homeTeam.name} {t('common.vs')} {match.awayTeam.name}
        </Text>
        <Flag code={match.awayTeam.code} size={18} />
      </View>
      <Text style={styles.missingLabel}>{t('common.missing')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 18, paddingBottom: 100, gap: 18 },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 4, alignSelf: 'flex-start' },
  backText: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },

  heroSection: { alignItems: 'center', gap: 10, paddingTop: 4 },
  avatarWrapper: { borderRadius: 999 },
  avatarWrapperMe: {
    borderWidth: 3,
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  heroInfo: { alignItems: 'center', maxWidth: '100%' },
  heroName: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  heroSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2, maxWidth: 300 },
  heroBadges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  pill: { borderRadius: 9999, paddingHorizontal: 14, paddingVertical: 5 },
  pillText: { fontFamily: fonts.displayBold, fontSize: 13, fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: { fontFamily: fonts.displayBold, fontSize: 16, fontWeight: '700' },
  statLabel: { color: colors.dim, fontFamily: fonts.body, fontSize: 9, marginTop: 2, textAlign: 'center' },

  sectionLabel: {
    color: colors.dim,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  cardsColumn: { gap: 8 },

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

  matchCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    paddingHorizontal: 16,
  },
  matchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  matchMeta: { color: colors.dim, fontFamily: fonts.body, fontSize: 10, flexShrink: 1 },
  noPick: { color: colors.dim, fontFamily: fonts.body, fontSize: 10 },

  matchRow: { flexDirection: 'row', alignItems: 'center' },
  teamSide: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  teamSideRight: { justifyContent: 'flex-end' },
  teamName: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 12, fontWeight: '500', flexShrink: 1 },
  scoreBlock: { paddingHorizontal: 8, minWidth: 72, alignItems: 'center' },
  score: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 16, fontWeight: '700' },
  pickLabel: { color: colors.dim, fontFamily: fonts.body, fontSize: 10, marginTop: 1 },

  badge: { borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontFamily: fonts.displayBold, fontSize: 11, fontWeight: '700' },

  pendingRow: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(236,126,0,0.25)',
    padding: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  pendingTeams: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  pendingTeamText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 12, flexShrink: 1 },
  missingLabel: { color: colors.warning, fontFamily: fonts.bodyMedium, fontSize: 10, fontWeight: '600' },

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

  reminderBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 18,
    paddingBottom: 34,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reminderBtn: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  reminderBtnText: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 15, fontWeight: '600' },
});

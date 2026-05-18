import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NotifyModal from '../components/NotifyModal';
import InviteSheet from '../components/InviteSheet';
import LeaveConfirmModal from '../components/LeaveConfirmModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommonActions, RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import {
  addLeagueAdmin,
  deleteLeague,
  fetchLeague,
  leaveLeague,
  remindMissingPickMembers,
  notifyLeagueMembers,
  remindUnpaidLeagueMembers,
  removeLeagueAdmin,
  updateLeagueMemberPayment,
  updateLeaguePaymentSettings,
} from '../api/leagues';
import { League, LeagueMember, LeaguePaymentSettings } from '../types';
import { colors, fonts } from '../theme';
import Avatar from '../components/ui/Avatar';
import BottomSheet from '../components/ui/BottomSheet';
import LeagueRaceStrip from '../components/LeagueRaceStrip';
import { useAuthStore } from '../store/authStore';
import {
  avatarColor,
  getMemberRank,
  isCurrentMember,
  memberAvatarUrl,
  memberId,
  memberName,
  memberPoints,
  sortMembersByPoints,
} from '../utils/league';
import { useI18n } from '../i18n';
import { getApiErrorMessage } from '../utils/apiError';

type RouteParams = { LeagueDetail: { leagueId: string } };

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children.toUpperCase()}</Text>;
}

function formatEuros(amount: number) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `€${amount}`;
  }
}

export default function LeagueDetailScreen() {
  const { t } = useI18n();
  const route = useRoute<RouteProp<RouteParams, 'LeagueDetail'>>();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifyModalVisible, setNotifyModalVisible] = useState(false);
  const [inviteSheetVisible, setInviteSheetVisible] = useState(false);
  const [leaveModalVisible, setLeaveModalVisible] = useState(false);
  const [settingsSheetVisible, setSettingsSheetVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentUpdatingMemberId, setPaymentUpdatingMemberId] = useState<string | null>(null);
  const [adminUpdatingMemberId, setAdminUpdatingMemberId] = useState<string | null>(null);
  const [remindingUnpaid, setRemindingUnpaid] = useState(false);
  const [remindingMissingPicks, setRemindingMissingPicks] = useState(false);

  const loadLeague = useCallback(async () => {
    try {
      const data = await fetchLeague(route.params.leagueId);
      setLeague(data);
    } finally {
      setLoading(false);
    }
  }, [route.params.leagueId]);

  useEffect(() => {
    loadLeague();
  }, [loadLeague]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeague();
    setRefreshing(false);
  };


  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!league) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{t('league.notFound')}</Text>
      </View>
    );
  }

  const sorted = sortMembersByPoints(league.members);
  const leader = sorted[0];
  const myRank = getMemberRank(league.members, user?.id);
  const me = sorted.find((member) => isCurrentMember(member, user?.id));
  const myPoints = me ? memberPoints(me) : 0;
  const accent = colors.accent;
  const accentDim = colors.accentDim;
  const isAdmin = me?.isAdmin || league.ownerId?.id === user?.id || (league.ownerId as any)?._id === user?.id;
  const isOwner = league.ownerId?.id === user?.id || (league.ownerId as any)?._id === user?.id;
  const paymentSettings = league.paymentSettings ?? {
    entryFee: 0,
    payoutSplits: [
      { position: 1, amount: 0 },
      { position: 2, amount: 0 },
      { position: 3, amount: 0 },
    ],
  };
  const paidCount = league.members.filter((member) => member.hasPaid).length;
  const totalPot = paymentSettings.entryFee * league.members.length;

  const handleDeleteLeague = () => {
    Alert.alert(
      t('league.deleteTitle'),
      t('league.deleteConfirm', { name: league.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('league.deleteAction'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLeague(league._id);
              setLeague(null);
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'LeagueList' }],
                })
              );
            } catch (err: any) {
              Alert.alert(t('common.error'), getApiErrorMessage(err, t('league.deleteFailed')));
            }
          },
        },
      ]
    );
  };

  const handleLeaveConfirm = async () => {
    try {
      await leaveLeague(league._id);
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'LeagueList' }] })
      );
    } catch (err: any) {
      Alert.alert(t('common.error'), getApiErrorMessage(err, t('league.leaveFailed')));
    }
  };

  const handleToggleAdmin = async (member: LeagueMember) => {
    const id = memberId(member);
    if (!id || adminUpdatingMemberId) return;
    setAdminUpdatingMemberId(id);
    try {
      if (member.isAdmin) {
        await removeLeagueAdmin(league._id, id);
      } else {
        await addLeagueAdmin(league._id, id);
      }
      await loadLeague();
    } catch (err: any) {
      Alert.alert(t('common.error'), getApiErrorMessage(err, t('league.adminUpdateFailed')));
    } finally {
      setAdminUpdatingMemberId(null);
    }
  };

  const handleRemindUnpaid = async () => {
    if (remindingUnpaid) return;

    setRemindingUnpaid(true);
    try {
      const result = await remindUnpaidLeagueMembers(league._id);
      Alert.alert(t('payments.reminderSentTitle'), t('payments.reminderSentBody', { count: result.recipients }));
    } catch (err: any) {
      Alert.alert(t('common.error'), getApiErrorMessage(err, t('payments.reminderFailed')));
    } finally {
      setRemindingUnpaid(false);
    }
  };

  const handleRemindMissingPicks = async () => {
    if (remindingMissingPicks) return;

    setRemindingMissingPicks(true);
    try {
      const result = await remindMissingPickMembers(league._id);
      Alert.alert(
        t('picksReminder.sentTitle'),
        t('picksReminder.sentBody', { count: result.recipients, matches: result.matches })
      );
    } catch (err: any) {
      Alert.alert(t('common.error'), getApiErrorMessage(err, t('picksReminder.failed')));
    } finally {
      setRemindingMissingPicks(false);
    }
  };

  const handleSavePaymentSettings = async (settings: LeaguePaymentSettings) => {
    setPaymentSaving(true);
    try {
      const updatedLeague = await updateLeaguePaymentSettings(league._id, settings);
      setLeague(updatedLeague);
      setPaymentModalVisible(false);
    } catch (err: any) {
      Alert.alert(t('common.error'), getApiErrorMessage(err, t('payments.saveFailed')));
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleToggleMemberPayment = async (member: LeagueMember) => {
    const id = memberId(member);
    if (!id || paymentUpdatingMemberId) return;
    setPaymentUpdatingMemberId(id);
    try {
      const updatedLeague = await updateLeagueMemberPayment(league._id, id, !member.hasPaid);
      setLeague(updatedLeague);
    } catch (err: any) {
      Alert.alert(t('common.error'), getApiErrorMessage(err, t('payments.memberSaveFailed')));
    } finally {
      setPaymentUpdatingMemberId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <View style={styles.titleRow}>
          <View style={styles.titleMain}>
            <Text style={styles.title}>{league.name}</Text>
            <Text style={styles.subtitle}>{t('league.playersGroupStage', { count: league.members.length })}</Text>
          </View>
          <TouchableOpacity style={styles.shareIconBtn} onPress={() => setInviteSheetVisible(true)} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={20} color={colors.muted} />
          </TouchableOpacity>
          {isAdmin && (
            <TouchableOpacity style={styles.shareIconBtn} onPress={() => setSettingsSheetVisible(true)} activeOpacity={0.7}>
              <Ionicons name="settings-outline" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.statsRow}>
          <StatCard label={t('league.yourRank')} value={myRank ? `#${myRank}` : '—'} color={accent} />
          <StatCard label={t('league.yourPoints')} value={`${myPoints}`} color={colors.text} />
          <StatCard label={t('league.leader')} value={leader ? `${memberPoints(leader)} ${t('common.pointsShort')}` : '—'} color={colors.text} />
        </View>

        <View style={styles.raceCard}>
          <SectionLabel>{t('league.pointsRace')}</SectionLabel>
          <LeagueRaceStrip members={league.members} userId={user?.id} accent={accent} accentDim={accentDim} />
        </View>

        <View>
          <SectionLabel>{t('league.rankings')}</SectionLabel>
          <View style={styles.rankingsCard}>
            {sorted.map((member, index) => (
              <RankingRow
                key={memberId(member) || String(index)}
                member={member}
                index={index}
                userId={user?.id}
                accent={accent}
                accentDim={accentDim}
                isLast={index === sorted.length - 1}
                isAdminViewer={isAdmin}
                paymentUpdating={paymentUpdatingMemberId === memberId(member)}
                onTogglePayment={() => handleToggleMemberPayment(member)}
                onPress={() =>
                  navigation.navigate('MemberScreen', {
                    leagueId: league._id,
                    leagueName: league.name,
                    memberId: memberId(member),
                    memberName: memberName(member),
                    memberColor: avatarColor(memberId(member) || String(index)),
                    memberAvatarUrl: memberAvatarUrl(member),
                    memberPoints: memberPoints(member),
                    memberRank: index + 1,
                    totalMembers: league.members.length,
                    isAdmin,
                    isMe: isCurrentMember(member, user?.id),
                  })
                }
              />
            ))}
          </View>
        </View>

        <View style={[styles.paymentCard, !isAdmin && styles.paymentCardCompact]}>
          <View style={styles.sectionHeaderRow}>
            <SectionLabel>{t('payments.title')}</SectionLabel>
            {isAdmin && (
              <TouchableOpacity
                style={styles.smallIconButton}
                onPress={() => setSettingsSheetVisible(true)}
                activeOpacity={0.75}
              >
                <Ionicons name="settings-outline" size={16} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>
          {isAdmin ? (
            <>
              <View style={styles.paymentSummaryRow}>
                <View style={styles.paymentSummaryItem}>
                  <Text style={styles.paymentValue}>{formatEuros(paymentSettings.entryFee)}</Text>
                  <Text style={styles.paymentLabel}>{t('payments.entryFee')}</Text>
                </View>
                <View style={styles.paymentSummaryItem}>
                  <Text style={styles.paymentValue}>{formatEuros(totalPot)}</Text>
                  <Text style={styles.paymentLabel}>{t('payments.pot')}</Text>
                </View>
                <View style={styles.paymentSummaryItem}>
                  <Text style={styles.paymentValue}>{paidCount}/{league.members.length}</Text>
                  <Text style={styles.paymentLabel}>{t('payments.paid')}</Text>
                </View>
              </View>
              <View style={styles.payoutList}>
                {[...paymentSettings.payoutSplits]
                  .sort((a, b) => a.position - b.position)
                  .map((split) => (
                    <View key={split.position} style={styles.payoutRow}>
                      <Text style={styles.payoutLabel}>{t('payments.position', { position: split.position })}</Text>
                      <Text style={styles.payoutValue}>{formatEuros(split.amount)}</Text>
                    </View>
                  ))}
              </View>
            </>
          ) : (
            <View style={styles.paymentCompactRow}>
              <View style={styles.paymentCompactItem}>
                <Text style={styles.paymentCompactValue}>{formatEuros(paymentSettings.entryFee)}</Text>
                <Text style={styles.paymentLabel}>{t('payments.entryFee')}</Text>
              </View>
              <View style={styles.paymentCompactDivider} />
              <View style={styles.paymentCompactItemWide}>
                <Text style={styles.paymentCompactValue} numberOfLines={1}>
                  {[...paymentSettings.payoutSplits]
                    .sort((a, b) => a.position - b.position)
                    .map((split) => `${t('payments.position', { position: split.position })} ${formatEuros(split.amount)}`)
                    .join('  ·  ')}
                </Text>
                <Text style={styles.paymentLabel}>{t('payments.payoutSplit')}</Text>
              </View>
            </View>
          )}
        </View>

        {!isOwner && !isAdmin && (
          <TouchableOpacity style={styles.leaveBtn} onPress={() => setLeaveModalVisible(true)} activeOpacity={0.85}>
            <Text style={styles.deleteBtnText}>{t('league.leaveAction')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <NotifyModal
        visible={notifyModalVisible}
        title={t('league.notifyTitle', { name: league.name })}
        onClose={() => setNotifyModalVisible(false)}
        onSend={(title, body) => notifyLeagueMembers(league._id, title, body)}
      />
      <InviteSheet
        visible={inviteSheetVisible}
        leagueName={league.name}
        inviteCode={league.inviteCode}
        onClose={() => setInviteSheetVisible(false)}
      />
      <LeaveConfirmModal
        visible={leaveModalVisible}
        leagueName={league.name}
        onClose={() => setLeaveModalVisible(false)}
        onConfirm={handleLeaveConfirm}
      />
      {settingsSheetVisible && (
        <LeagueSettingsSheet
          league={league}
          isOwner={isOwner}
          adminUpdatingMemberId={adminUpdatingMemberId}
          remindingUnpaid={remindingUnpaid}
          remindingMissingPicks={remindingMissingPicks}
          onClose={() => setSettingsSheetVisible(false)}
          onInvite={() => {
            setSettingsSheetVisible(false);
            setInviteSheetVisible(true);
          }}
          onNotify={() => {
            setSettingsSheetVisible(false);
            setNotifyModalVisible(true);
          }}
          onEditPayments={() => {
            setSettingsSheetVisible(false);
            setPaymentModalVisible(true);
          }}
          onRemindUnpaid={handleRemindUnpaid}
          onRemindMissingPicks={handleRemindMissingPicks}
          onToggleAdmin={handleToggleAdmin}
          onDeleteLeague={() => {
            setSettingsSheetVisible(false);
            handleDeleteLeague();
          }}
          onLeaveLeague={() => {
            setSettingsSheetVisible(false);
            setLeaveModalVisible(true);
          }}
        />
      )}
      <PaymentSettingsModal
        visible={paymentModalVisible}
        settings={paymentSettings}
        saving={paymentSaving}
        onClose={() => !paymentSaving && setPaymentModalVisible(false)}
        onSave={handleSavePaymentSettings}
      />
    </SafeAreaView>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RankingRow({
  member,
  index,
  userId,
  accent,
  accentDim,
  isLast,
  isAdminViewer,
  paymentUpdating,
  onTogglePayment,
  onPress,
}: {
  member: LeagueMember;
  index: number;
  userId?: string;
  accent: string;
  accentDim: string;
  isLast: boolean;
  isAdminViewer: boolean;
  paymentUpdating: boolean;
  onTogglePayment: () => void;
  onPress: () => void;
}) {
  const { t } = useI18n();
  const isMe = isCurrentMember(member, userId);
  const id = memberId(member) || String(index);
  const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;

  return (
    <TouchableOpacity
      style={[
        styles.memberRow,
        !isLast && styles.memberRowBorder,
        isMe && { backgroundColor: accentDim },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.rankCell}>
        <Text style={medal ? styles.medal : styles.rankNum}>{medal || index + 1}</Text>
      </View>
      <Avatar name={memberName(member)} color={avatarColor(id)} imageUrl={memberAvatarUrl(member)} size={34} />
      <View style={styles.memberInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.memberName} numberOfLines={1}>{memberName(member)}</Text>
          {isMe && (
            <View style={[styles.youBadge, { backgroundColor: accentDim }]}>
              <Text style={[styles.youText, { color: accent }]}>{t('common.you')}</Text>
            </View>
          )}
        </View>
        <Text style={styles.memberMeta}>{member.isAdmin ? t('common.admin') : t('common.member')}</Text>
      </View>
      <Text style={[styles.points, isMe && { color: accent }]}>
        {memberPoints(member)}
        <Text style={styles.pointsSuffix}> {t('common.pointsShort')}</Text>
      </Text>
      {isAdminViewer && (
        <TouchableOpacity
          style={[styles.paidToggle, member.hasPaid && styles.paidToggleOn]}
          onPress={onTogglePayment}
          disabled={paymentUpdating}
          activeOpacity={0.75}
        >
          {paymentUpdating ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Text style={[styles.paidToggleText, member.hasPaid && styles.paidToggleTextOn]}>
              {member.hasPaid ? t('payments.paid') : t('payments.unpaid')}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function LeagueSettingsSheet({
  league,
  isOwner,
  adminUpdatingMemberId,
  remindingUnpaid,
  remindingMissingPicks,
  onClose,
  onInvite,
  onNotify,
  onEditPayments,
  onRemindUnpaid,
  onRemindMissingPicks,
  onToggleAdmin,
  onDeleteLeague,
  onLeaveLeague,
}: {
  league: League;
  isOwner: boolean;
  adminUpdatingMemberId: string | null;
  remindingUnpaid: boolean;
  remindingMissingPicks: boolean;
  onClose: () => void;
  onInvite: () => void;
  onNotify: () => void;
  onEditPayments: () => void;
  onRemindUnpaid: () => void;
  onRemindMissingPicks: () => void;
  onToggleAdmin: (member: LeagueMember) => void;
  onDeleteLeague: () => void;
  onLeaveLeague: () => void;
}) {
  const { t } = useI18n();
  const ownerId = league.ownerId?.id || (league.ownerId as any)?._id || '';
  const unpaidCount = league.members.filter((member) => !member.hasPaid).length;

  return (
    <BottomSheet onClose={onClose}>
      <ScrollView style={styles.settingsSheet} contentContainerStyle={styles.settingsContent}>
        <Text style={styles.settingsTitle}>{t('league.settingsTitle')}</Text>
        <Text style={styles.settingsSubtitle}>{league.name}</Text>

        <View style={styles.settingsSection}>
          <SettingsActionRow icon="share-outline" label={t('league.inviteMembers')} onPress={onInvite} />
          <SettingsActionRow icon="notifications-outline" label={t('league.notifyMembers')} onPress={onNotify} />
          <SettingsActionRow
            icon="alarm-outline"
            label={t('picksReminder.remindMissing')}
            detail={t('picksReminder.next24h')}
            loading={remindingMissingPicks}
            disabled={remindingMissingPicks}
            onPress={onRemindMissingPicks}
          />
          <SettingsActionRow icon="card-outline" label={t('payments.editTitle')} onPress={onEditPayments} />
          <SettingsActionRow
            icon="mail-unread-outline"
            label={t('payments.remindUnpaid')}
            detail={unpaidCount > 0 ? t('payments.unpaidCount', { count: unpaidCount }) : t('payments.allPaid')}
            loading={remindingUnpaid}
            disabled={unpaidCount === 0 || remindingUnpaid}
            onPress={onRemindUnpaid}
          />
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionLabel}>{t('league.admins')}</Text>
          {league.members.map((member, index) => {
            const id = memberId(member);
            const memberIsOwner = id === ownerId;
            const updating = adminUpdatingMemberId === id;

            return (
              <View
                key={id || String(index)}
                style={[styles.adminRow, index < league.members.length - 1 && styles.adminRowBorder]}
              >
                <Avatar name={memberName(member)} color={avatarColor(id || String(index))} imageUrl={memberAvatarUrl(member)} size={32} />
                <View style={styles.adminInfo}>
                  <Text style={styles.adminName} numberOfLines={1}>{memberName(member)}</Text>
                  <Text style={styles.adminMeta}>
                    {memberIsOwner ? t('league.owner') : member.isAdmin ? t('common.admin') : t('common.member')}
                  </Text>
                </View>
                {memberIsOwner ? (
                  <View style={styles.ownerPill}>
                    <Text style={styles.ownerPillText}>{t('league.owner')}</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.adminToggle, member.isAdmin && styles.adminToggleOn]}
                    onPress={() => onToggleAdmin(member)}
                    disabled={updating}
                    activeOpacity={0.75}
                  >
                    {updating ? (
                      <ActivityIndicator color={colors.text} size="small" />
                    ) : (
                      <Text style={[styles.adminToggleText, member.isAdmin && styles.adminToggleTextOn]}>
                        {member.isAdmin ? t('league.removeAdmin') : t('league.makeAdmin')}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.settingsSection}>
          {isOwner ? (
            <SettingsActionRow icon="trash-outline" label={t('league.deleteAction')} danger onPress={onDeleteLeague} />
          ) : (
            <SettingsActionRow icon="exit-outline" label={t('league.leaveAction')} danger onPress={onLeaveLeague} />
          )}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

function SettingsActionRow({
  icon,
  label,
  detail,
  danger,
  disabled,
  loading,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail?: string;
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.settingsActionRow, disabled && styles.settingsActionRowDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      <Ionicons name={icon} size={19} color={danger ? colors.danger : colors.muted} />
      <View style={styles.settingsActionCopy}>
        <Text style={[styles.settingsActionText, danger && styles.settingsActionTextDanger]}>{label}</Text>
        {!!detail && <Text style={styles.settingsActionDetail}>{detail}</Text>}
      </View>
      {loading ? (
        <ActivityIndicator color={colors.muted} size="small" />
      ) : (
        <Ionicons name="chevron-forward" size={17} color={colors.dim} />
      )}
    </TouchableOpacity>
  );
}

function PaymentSettingsModal({
  visible,
  settings,
  saving,
  onClose,
  onSave,
}: {
  visible: boolean;
  settings: LeaguePaymentSettings;
  saving: boolean;
  onClose: () => void;
  onSave: (settings: LeaguePaymentSettings) => void;
}) {
  const { t } = useI18n();
  const [entryFee, setEntryFee] = useState(String(settings.entryFee));
  const [firstPrize, setFirstPrize] = useState(String(settings.payoutSplits.find((s) => s.position === 1)?.amount ?? 0));
  const [secondPrize, setSecondPrize] = useState(String(settings.payoutSplits.find((s) => s.position === 2)?.amount ?? 0));
  const [thirdPrize, setThirdPrize] = useState(String(settings.payoutSplits.find((s) => s.position === 3)?.amount ?? 0));

  useEffect(() => {
    if (!visible) return;
    setEntryFee(String(settings.entryFee));
    setFirstPrize(String(settings.payoutSplits.find((s) => s.position === 1)?.amount ?? 0));
    setSecondPrize(String(settings.payoutSplits.find((s) => s.position === 2)?.amount ?? 0));
    setThirdPrize(String(settings.payoutSplits.find((s) => s.position === 3)?.amount ?? 0));
  }, [settings, visible]);

  const save = () => {
    const fee = Number(entryFee || 0);
    const prizes = [Number(firstPrize || 0), Number(secondPrize || 0), Number(thirdPrize || 0)];
    if (
      Number.isNaN(fee) ||
      fee < 0 ||
      prizes.some((value) => Number.isNaN(value) || value < 0)
    ) {
      Alert.alert(t('common.error'), t('payments.invalidSettings'));
      return;
    }

    onSave({
      entryFee: fee,
      payoutSplits: [
        { position: 1, amount: prizes[0] },
        { position: 2, amount: prizes[1] },
        { position: 3, amount: prizes[2] },
      ],
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.paymentModal}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{t('payments.editTitle')}</Text>
          <Text style={styles.modalBody}>{t('payments.lockHint')}</Text>
          <Text style={styles.label}>{t('payments.entryFee')}</Text>
          <TextInput
            style={[styles.modalInput, styles.modalInputGap]}
            value={entryFee}
            onChangeText={setEntryFee}
            placeholder="0 EUR"
            placeholderTextColor={colors.dim}
            keyboardType="decimal-pad"
          />
          <Text style={styles.label}>{t('payments.payoutSplit')}</Text>
          <View style={styles.splitRow}>
            <ModalSplitInput label="1st" value={firstPrize} onChangeText={setFirstPrize} />
            <ModalSplitInput label="2nd" value={secondPrize} onChangeText={setSecondPrize} />
            <ModalSplitInput label="3rd" value={thirdPrize} onChangeText={setThirdPrize} />
          </View>
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelButton} onPress={onClose} disabled={saving}>
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSaveButton} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSaveText}>{t('common.done')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ModalSplitInput({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.modalSplitInputWrap}>
      <Text style={styles.modalSplitLabel}>{label}</Text>
      <TextInput
        style={[styles.modalInput, styles.modalPrizeInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder="0"
        placeholderTextColor={colors.dim}
        keyboardType="decimal-pad"
      />
      <Text style={styles.modalEuroSign}>€</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  scroll: { padding: 18, paddingBottom: 20, gap: 18 },

  titleRow: { marginTop: 4, flexDirection: 'row', alignItems: 'flex-start' },
  titleMain: { flex: 1 },
  title: { color: colors.text, fontSize: 30, fontFamily: fonts.display },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 3, fontFamily: fonts.body },
  shareIconBtn: { padding: 6, marginTop: 4 },

  sectionLabel: {
    color: colors.dim,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: 8,
  },

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
  statValue: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  statLabel: {
    color: colors.dim,
    fontFamily: fonts.body,
    fontSize: 9,
    marginTop: 2,
  },

  raceCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  smallIconButton: { padding: 4, marginTop: -8 },
  paymentCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    paddingHorizontal: 18,
    gap: 14,
  },
  paymentCardCompact: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
    paddingVertical: 12,
    gap: 6,
  },
  paymentSummaryRow: { flexDirection: 'row', gap: 8 },
  paymentSummaryItem: {
    flex: 1,
    backgroundColor: colors.card2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  paymentValue: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 15, fontWeight: '700' },
  paymentLabel: { color: colors.dim, fontFamily: fonts.body, fontSize: 10, marginTop: 3 },
  payoutList: { gap: 8 },
  payoutRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  payoutLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  payoutValue: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 12, fontWeight: '600' },
  paymentCompactRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  paymentCompactItem: { minWidth: 76 },
  paymentCompactItemWide: { flex: 1, minWidth: 0 },
  paymentCompactValue: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 13, fontWeight: '600' },
  paymentCompactDivider: { width: 1, height: 28, backgroundColor: colors.border },

  rankingsCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  memberRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rankCell: { width: 24, alignItems: 'center' },
  medal: { fontSize: 16 },
  rankNum: { color: colors.dim, fontFamily: fonts.displayBold, fontSize: 13, fontWeight: '700' },
  memberInfo: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  memberName: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  memberMeta: { color: colors.dim, fontFamily: fonts.body, fontSize: 10, marginTop: 1 },
  youBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 1 },
  youText: { fontFamily: fonts.bodyMedium, fontSize: 10, fontWeight: '600' },
  points: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 16, fontWeight: '700' },
  pointsSuffix: { color: colors.muted, fontFamily: fonts.body, fontSize: 10, fontWeight: '400' },
  paidToggle: {
    minWidth: 64,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderMid,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  paidToggleOn: { backgroundColor: colors.accentDim, borderColor: 'rgba(0,168,126,0.25)' },
  paidToggleText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 10, fontWeight: '700' },
  paidToggleTextOn: { color: colors.accent },
  emptyText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 16 },

  notifyBtn: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 13,
    alignItems: 'center',
  },
  notifyBtnText: {
    color: colors.accent,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    fontWeight: '600',
  },
  deleteBtn: {
    backgroundColor: 'rgba(226,59,74,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(226,59,74,0.25)',
    paddingVertical: 13,
    alignItems: 'center',
  },
  deleteBtnText: {
    color: colors.danger,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    fontWeight: '600',
  },
  leaveBtn: {
    backgroundColor: 'transparent',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: 13,
    alignItems: 'center',
  },
  settingsSheet: { flex: 1 },
  settingsContent: { padding: 22, paddingTop: 18, paddingBottom: 34, gap: 16 },
  settingsTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  settingsSubtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    marginTop: -10,
  },
  settingsSection: {
    backgroundColor: colors.card2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  settingsSectionLabel: {
    color: colors.dim,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  settingsActionRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  settingsActionRowDisabled: { opacity: 0.45 },
  settingsActionCopy: { flex: 1, minWidth: 0 },
  settingsActionText: {
    color: colors.text,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    fontWeight: '600',
  },
  settingsActionDetail: { color: colors.dim, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  settingsActionTextDanger: { color: colors.danger },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  adminRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  adminInfo: { flex: 1, minWidth: 0 },
  adminName: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 14, fontWeight: '600' },
  adminMeta: { color: colors.dim, fontFamily: fonts.body, fontSize: 10, marginTop: 1 },
  adminToggle: {
    minWidth: 92,
    minHeight: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderMid,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  adminToggleOn: { backgroundColor: colors.accentDim, borderColor: 'rgba(0,168,126,0.25)' },
  adminToggleText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 10, fontWeight: '700' },
  adminToggleTextOn: { color: colors.accent },
  ownerPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderMid,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ownerPillText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 10, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  paymentModal: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 24,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 34,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalBody: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', marginBottom: 18 },
  label: {
    color: colors.dim,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  splitRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  modalInput: {
    backgroundColor: colors.card2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  modalInputGap: { marginBottom: 16 },
  modalSplitInputWrap: { flex: 1 },
  modalSplitLabel: {
    color: colors.dim,
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 6,
  },
  modalPrizeInput: { paddingRight: 26 },
  modalEuroSign: { position: 'absolute', right: 10, bottom: 13, color: colors.muted, fontSize: 14 },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancelButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderMid,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCancelText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 14, fontWeight: '700' },
  modalSaveButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSaveText: { color: '#fff', fontFamily: fonts.bodyMedium, fontSize: 14, fontWeight: '700' },
});

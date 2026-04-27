import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  RefreshControl,
} from 'react-native';
import NotifyModal from '../components/NotifyModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { fetchLeague, notifyLeagueMembers } from '../api/leagues';
import { League, LeagueMember } from '../types';
import { colors, fonts } from '../theme';
import Avatar from '../components/ui/Avatar';
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

type RouteParams = { LeagueDetail: { leagueId: string } };

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children.toUpperCase()}</Text>;
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

  const handleShare = async () => {
    if (!league) return;
    await Share.share({
      message: t('league.shareMessage', { name: league.name, code: league.inviteCode }),
    });
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>{league.name}</Text>
          <Text style={styles.subtitle}>{t('league.playersGroupStage', { count: league.members.length })}</Text>
        </View>

        <View style={styles.statsRow}>
          <StatCard label={t('league.yourRank')} value={myRank ? `#${myRank}` : '—'} color={accent} />
          <StatCard label={t('league.yourPoints')} value={`${myPoints}`} color={colors.text} />
          <StatCard label={t('league.leader')} value={leader ? `${memberPoints(leader)} ${t('common.pointsShort')}` : '—'} color={colors.text} />
        </View>

        <TouchableOpacity style={styles.inviteCard} onPress={handleShare} activeOpacity={0.85}>
          <View>
            <Text style={styles.inviteLabel}>{t('league.inviteCode')}</Text>
            <Text style={styles.inviteCode}>{league.inviteCode}</Text>
          </View>
          <View style={styles.sharePill}>
            <Text style={styles.shareText}>{t('common.share')}</Text>
          </View>
        </TouchableOpacity>

        {isAdmin && (
          <TouchableOpacity style={styles.notifyBtn} onPress={() => setNotifyModalVisible(true)} activeOpacity={0.85}>
            <Text style={styles.notifyBtnText}>{t('league.notifyMembers')}</Text>
          </TouchableOpacity>
        )}

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
      </ScrollView>

      <NotifyModal
        visible={notifyModalVisible}
        title={t('league.notifyTitle', { name: league.name })}
        onClose={() => setNotifyModalVisible(false)}
        onSend={(title, body) => notifyLeagueMembers(league._id, title, body)}
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
  onPress,
}: {
  member: LeagueMember;
  index: number;
  userId?: string;
  accent: string;
  accentDim: string;
  isLast: boolean;
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  scroll: { padding: 18, paddingBottom: 20, gap: 18 },

  titleRow: { marginTop: 4 },
  title: { color: colors.text, fontSize: 30, fontFamily: fonts.display },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 3, fontFamily: fonts.body },

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

  inviteCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteLabel: { color: colors.dim, fontFamily: fonts.bodyMedium, fontSize: 11, textTransform: 'uppercase' },
  inviteCode: {
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 3,
    marginTop: 3,
  },
  sharePill: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  shareText: { color: '#fff', fontFamily: fonts.bodyMedium, fontSize: 12, fontWeight: '600' },

  raceCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },

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
});

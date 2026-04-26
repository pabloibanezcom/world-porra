import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { fetchMemberPredictions, MemberMatchPrediction, MemberUpcomingMatch } from '../api/leagues';
import { colors, fonts } from '../theme';
import Avatar from '../components/ui/Avatar';
import Flag from '../components/ui/Flag';
import NotifyModal from '../components/NotifyModal';
import { notifyLeagueMembers } from '../api/leagues';
import { useI18n } from '../i18n';

type RouteParams = {
  MemberScreen: {
    leagueId: string;
    leagueName: string;
    memberId: string;
    memberName: string;
    memberColor: string;
    memberPoints: number;
    memberRank: number;
    totalMembers: number;
    isAdmin: boolean;
    isMe: boolean;
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

function formatMatchDate(utcDate: string, locale: string): string {
  return new Date(utcDate).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

export default function MemberScreen() {
  const { language, t } = useI18n();
  const route = useRoute<RouteProp<RouteParams, 'MemberScreen'>>();
  const navigation = useNavigation();
  const {
    leagueId,
    leagueName,
    memberId,
    memberName: name,
    memberColor,
    memberPoints: points,
    memberRank: rank,
    totalMembers,
    isAdmin,
    isMe,
  } = route.params;

  const [finishedMatches, setFinishedMatches] = useState<MemberMatchPrediction[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<MemberUpcomingMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifyVisible, setNotifyVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchMemberPredictions(leagueId, memberId);
      setFinishedMatches(data.finishedMatches);
      setUpcomingMatches(data.upcomingMatches);
    } finally {
      setLoading(false);
    }
  }, [leagueId, memberId, language]);

  useEffect(() => {
    load();
  }, [load]);

  const picksTotal = finishedMatches.length + upcomingMatches.length;
  const picksMade = finishedMatches.filter((m) => m.prediction !== null).length +
    upcomingMatches.filter((m) => m.hasPick).length;
  const pending = upcomingMatches.filter((m) => !m.hasPick).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.muted} />
          <Text style={styles.backText}>{leagueName}</Text>
        </TouchableOpacity>

        {/* Avatar + name */}
        <View style={styles.heroSection}>
          <View
            style={[
              styles.avatarWrapper,
              isMe && { borderWidth: 3, borderColor: colors.accent, shadowColor: colors.accent, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
            ]}
          >
            <Avatar name={name} color={memberColor} size={76} />
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>{isMe ? t('member.heroNameYou', { name }) : name}</Text>
            <Text style={styles.heroLeague}>{leagueName}</Text>
          </View>
          <View style={styles.heroBadges}>
            <View style={[styles.pill, { backgroundColor: colors.accentDim }]}>
              <Text style={[styles.pillText, { color: colors.accent }]}>{t('member.inLeague', { rank })}</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
              <Text style={[styles.pillText, { color: colors.text }]}>{points} {t('common.pointsShort')}</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard label={t('member.picksMade')} value={`${picksMade}/${picksTotal}`} color={colors.text} loading={loading} />
          <StatCard label={t('member.pending')} value={`${pending}`} color={colors.warning} loading={loading} />
          <StatCard label={t('common.rank')} value={`#${rank}/${totalMembers}`} color={colors.accent} loading={loading} />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Latest picks */}
            {finishedMatches.length > 0 && (
              <View>
                <SectionLabel>{t('member.latestPicks')}</SectionLabel>
                <View style={styles.cardsColumn}>
                  {finishedMatches.map((m) => (
                    <FinishedMatchCard key={m._id} match={m} />
                  ))}
                </View>
              </View>
            )}

            {/* Pending picks */}
            {upcomingMatches.filter((m) => !m.hasPick).length > 0 && (
              <View>
                <SectionLabel>{t('member.pendingPicks')}</SectionLabel>
                <View style={styles.cardsColumn}>
                  {upcomingMatches
                    .filter((m) => !m.hasPick)
                    .map((m) => (
                      <PendingMatchRow key={m._id} match={m} />
                    ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {isAdmin && !isMe && (
        <View style={styles.reminderBar}>
          <TouchableOpacity style={styles.reminderBtn} onPress={() => setNotifyVisible(true)} activeOpacity={0.85}>
            <Ionicons name="notifications-outline" size={18} color={colors.text} />
            <Text style={styles.reminderBtnText}>{t('member.sendReminder')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <NotifyModal
        visible={notifyVisible}
        title={t('member.remind', { name })}
        onClose={() => setNotifyVisible(false)}
        onSend={(title, body) => notifyLeagueMembers(leagueId, title, body)}
      />
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
  heroInfo: { alignItems: 'center' },
  heroName: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 22, fontWeight: '700' },
  heroLeague: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  heroBadges: { flexDirection: 'row', gap: 8 },
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
  statLabel: { color: colors.dim, fontFamily: fonts.body, fontSize: 9, marginTop: 2 },

  sectionLabel: {
    color: colors.dim,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  cardsColumn: { gap: 8 },

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
    marginBottom: 10,
  },
  matchMeta: { color: colors.dim, fontFamily: fonts.body, fontSize: 10 },
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
  },
  pendingTeams: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  pendingTeamText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 12, flexShrink: 1 },
  missingLabel: { color: colors.warning, fontFamily: fonts.bodyMedium, fontSize: 10, fontWeight: '600' },

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

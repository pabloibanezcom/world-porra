import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { fetchMatchPredictions, MatchPredictionVisibility } from '../api/predictions';
import { League, Match, User } from '../types';
import { colors, fonts } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useI18n } from '../i18n';
import Avatar from './ui/Avatar';
import Flag from './ui/Flag';
import { getTeamLabel } from './MatchCard';
import LiveBadge from './LiveBadge';
import { calculateLivePotentialPoints } from '../utils/livePoints';

interface Props {
  match: Match | null;
  leagues: League[];
  onClose: () => void;
}

function isStarted(match: Match): boolean {
  return match.status !== 'SCHEDULED' || Date.now() >= new Date(match.utcDate).getTime();
}

function predictionUser(prediction: MatchPredictionVisibility): Partial<User> & { id?: string } {
  if (typeof prediction.userId === 'string') return { id: prediction.userId, name: 'Player', avatarUrl: '' };
  return {
    id: prediction.userId.id ?? prediction.userId._id,
    name: prediction.userId.name,
    avatarUrl: prediction.userId.avatarUrl,
  };
}

function outcomeFor(homeGoals: number, awayGoals: number): 'HOME' | 'DRAW' | 'AWAY' {
  if (homeGoals > awayGoals) return 'HOME';
  if (awayGoals > homeGoals) return 'AWAY';
  return 'DRAW';
}

function userIdValue(user: League['members'][number]['userId']): string | null {
  if (!user) return null;
  if (typeof user === 'string') return user;
  return user.id ?? user._id ?? null;
}

export default function MatchPredictionsSheet({ match, leagues, onClose }: Props) {
  const { t, locale } = useI18n();
  const currentUser = useAuthStore((s) => s.user);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<MatchPredictionVisibility[]>([]);
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const memberLeagues = useMemo(
    () =>
      currentUser?.id
        ? leagues.filter((league) =>
            league.members.some((member) => userIdValue(member.userId) === currentUser.id)
          )
        : [],
    [currentUser?.id, leagues],
  );

  useEffect(() => {
    if (!match) return;
    setSelectedLeagueId((current) =>
      current && memberLeagues.some((league) => league._id === current)
        ? current
        : memberLeagues[0]?._id ?? null
    );
    setPredictions([]);
    setLoading(false);
    slideAnim.setValue(400);
    fadeAnim.setValue(0);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [match?._id, memberLeagues, fadeAnim, slideAnim]);

  useEffect(() => {
    if (!match || !isStarted(match) || !selectedLeagueId) {
      setPredictions([]);
      return;
    }

    let alive = true;
    setLoading(true);
    fetchMatchPredictions(match._id, selectedLeagueId)
      .then((nextPredictions) => {
        if (alive) setPredictions(nextPredictions);
      })
      .catch(() => {
        if (alive) setPredictions([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [match?._id, match?.status, selectedLeagueId]);

  const close = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 400, duration: 240, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const sortedPredictions = useMemo(
    () =>
      [...predictions].sort((a, b) => {
        const aUser = predictionUser(a);
        const bUser = predictionUser(b);
        if (aUser.id === currentUser?.id) return -1;
        if (bUser.id === currentUser?.id) return 1;
        return (aUser.name ?? '').localeCompare(bUser.name ?? '');
      }),
    [currentUser?.id, predictions],
  );

  if (!match) return null;

  const homeCode = getTeamLabel(match.homeTeam.name, match.homeTeam.code);
  const awayCode = getTeamLabel(match.awayTeam.name, match.awayTeam.code);
  const groupLabel = match.group ? t('common.group', { group: match.group }) : match.stage;
  const dateStr = new Date(match.utcDate).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  const timeStr = new Date(match.utcDate).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const selectedLeague = memberLeagues.find((league) => league._id === selectedLeagueId);
  const matchStarted = isStarted(match);
  const scoreText = match.result
    ? `${match.result.homeGoals} - ${match.result.awayGoals}`
    : t('matchCard.scorePending');
  const pickSummary = predictions.reduce(
    (summary, item) => {
      summary[outcomeFor(item.homeGoals, item.awayGoals)] += 1;
      return summary;
    },
    { HOME: 0, DRAW: 0, AWAY: 0 },
  );

  return (
    <Modal transparent visible={!!match} animationType="none" onRequestClose={close}>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />

        <View style={styles.matchHeader}>
          <View style={styles.matchTeams}>
            <Flag code={match.homeTeam.code} size={22} />
            <Text style={styles.teamCode}>{homeCode}</Text>
            <View style={styles.scorePill}>
              <Text style={styles.scoreText}>{scoreText}</Text>
            </View>
            <Text style={styles.teamCode}>{awayCode}</Text>
            <Flag code={match.awayTeam.code} size={22} />
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{groupLabel} · {dateStr} · {timeStr}</Text>
            <LiveBadge compact />
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('match.friendPicks')}</Text>
          {selectedLeague ? <Text style={styles.sectionMeta}>{selectedLeague.name}</Text> : null}
        </View>

        {!matchStarted ? (
          <Text style={styles.hint}>{t('match.friendPicksLocked')}</Text>
        ) : memberLeagues.length === 0 ? (
          <Text style={styles.hint}>{t('match.friendPicksNoLeague')}</Text>
        ) : (
          <>
            {memberLeagues.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.leagueTabs}>
                {memberLeagues.map((league) => (
                  <TouchableOpacity
                    key={league._id}
                    style={[styles.leagueTab, selectedLeagueId === league._id && styles.leagueTabActive]}
                    onPress={() => setSelectedLeagueId(league._id)}
                  >
                    <Text style={[styles.leagueTabText, selectedLeagueId === league._id && styles.leagueTabTextActive]}>
                      {league.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {loading ? (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : predictions.length === 0 ? (
              <Text style={styles.hint}>{t('match.friendPicksEmpty')}</Text>
            ) : (
              <>
                <View style={styles.pickSummary}>
                  <View style={styles.pickSummaryItem}>
                    <Text style={styles.pickSummaryValue}>{pickSummary.HOME}</Text>
                    <Text style={styles.pickSummaryLabel}>{homeCode}</Text>
                  </View>
                  <View style={styles.pickSummaryItem}>
                    <Text style={styles.pickSummaryValue}>{pickSummary.DRAW}</Text>
                    <Text style={styles.pickSummaryLabel}>X</Text>
                  </View>
                  <View style={styles.pickSummaryItem}>
                    <Text style={styles.pickSummaryValue}>{pickSummary.AWAY}</Text>
                    <Text style={styles.pickSummaryLabel}>{awayCode}</Text>
                  </View>
                </View>

                <ScrollView style={styles.friendRows} contentContainerStyle={styles.friendRowsContent}>
                  {sortedPredictions.map((item) => {
                    const user = predictionUser(item);
                    const isMe = user.id === currentUser?.id;
                    const outcome = outcomeFor(item.homeGoals, item.awayGoals);
                    const potentialPoints = calculateLivePotentialPoints(match, item);
                    return (
                      <View key={item._id} style={styles.friendRow}>
                        <Avatar name={user.name ?? 'Player'} imageUrl={user.avatarUrl} size={34} color={isMe ? colors.accent : colors.blue} />
                        <View style={styles.friendTextBlock}>
                          <Text style={styles.friendName}>{isMe ? t('common.you') : user.name ?? 'Player'}</Text>
                          <Text style={styles.friendOutcome}>
                            {outcome === 'DRAW'
                              ? t('match.friendPickDraw')
                              : t('match.friendPickWinner', { code: outcome === 'HOME' ? homeCode : awayCode })}
                          </Text>
                        </View>
                        <View style={styles.friendScoreBlock}>
                          <Text style={styles.friendScore}>{item.homeGoals} - {item.awayGoals}</Text>
                          {potentialPoints != null && (
                            <Text style={styles.friendPotentialPoints}>
                              {t('matchCard.potentialPoints', { points: potentialPoints })}
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </>
            )}
          </>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '82%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 22,
    paddingBottom: 36,
  },
  handle: {
    width: 34,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center',
    marginBottom: 18,
  },
  matchHeader: {
    alignItems: 'center',
    marginBottom: 18,
  },
  matchTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  teamCode: {
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 22,
    fontWeight: '800',
  },
  scorePill: {
    minWidth: 72,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.bg,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  scoreText: {
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 18,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  meta: {
    color: colors.dim,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.bodyMedium,
    fontSize: 17,
    fontWeight: '800',
  },
  sectionMeta: {
    color: colors.dim,
    flexShrink: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  hint: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  leagueTabs: {
    gap: 8,
    paddingBottom: 12,
  },
  leagueTab: {
    borderWidth: 1,
    borderColor: colors.borderMid,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  leagueTabActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  leagueTabText: {
    color: colors.textSecondary,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    fontWeight: '700',
  },
  leagueTabTextActive: {
    color: colors.text,
  },
  loading: {
    paddingVertical: 28,
  },
  pickSummary: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  pickSummaryItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.card2,
    paddingVertical: 10,
  },
  pickSummaryValue: {
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 22,
    fontWeight: '800',
  },
  pickSummaryLabel: {
    color: colors.muted,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  friendRows: {
    maxHeight: 300,
  },
  friendRowsContent: {
    paddingBottom: 4,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  friendTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  friendName: {
    color: colors.text,
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    fontWeight: '800',
  },
  friendOutcome: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  friendScore: {
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 20,
    fontWeight: '800',
  },
  friendScoreBlock: {
    alignItems: 'flex-end',
  },
  friendPotentialPoints: {
    color: colors.danger,
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 1,
  },
});

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { fetchMatch } from '../api/matches';
import { fetchMatchPredictions, MatchPredictionVisibility, submitPrediction } from '../api/predictions';
import { fetchMyLeagues } from '../api/leagues';
import { League, Match, Prediction, User } from '../types';
import { colors, spacing, fontSize, borderRadius, fonts } from '../theme';
import { format } from 'date-fns';
import { hasTbdTeam } from '../components/MatchCard';
import { useI18n } from '../i18n';
import { getPredictionLockTime, isPredictionLocked } from '../utils/prediction';
import { formatLockStatus } from '../utils/deadline';
import { getMatchRefreshDelay } from '../utils/matchRefresh';
import Avatar from '../components/ui/Avatar';
import { useAuthStore } from '../store/authStore';

type RouteParams = { MatchDetail: { matchId: string } };

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

export default function MatchDetailScreen() {
  const { language, t } = useI18n();
  const currentUser = useAuthStore((s) => s.user);
  const route = useRoute<RouteProp<RouteParams, 'MatchDetail'>>();
  const [match, setMatch] = useState<Match | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [visiblePredictions, setVisiblePredictions] = useState<MatchPredictionVisibility[]>([]);
  const [visiblePredictionsLoading, setVisiblePredictionsLoading] = useState(false);
  const [homeGoals, setHomeGoals] = useState(0);
  const [awayGoals, setAwayGoals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setLoading(true);
    loadMatch();
  }, [route.params.matchId, language]);

  useEffect(() => {
    fetchMyLeagues()
      .then((nextLeagues) => {
        setLeagues(nextLeagues);
        setSelectedLeagueId((current) => current ?? nextLeagues[0]?._id ?? null);
      })
      .catch(() => {
        setLeagues([]);
        setSelectedLeagueId(null);
      });
  }, []);

  useEffect(() => {
    const refreshDelay = match ? getMatchRefreshDelay([match]) : null;
    if (refreshDelay == null) return;

    const timeout = setTimeout(() => {
      loadMatch();
    }, refreshDelay);

    return () => clearTimeout(timeout);
  }, [match, route.params.matchId, language]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!match || !isStarted(match) || !selectedLeagueId) {
      setVisiblePredictions([]);
      return;
    }

    let alive = true;
    setVisiblePredictionsLoading(true);
    fetchMatchPredictions(match._id, selectedLeagueId)
      .then((predictions) => {
        if (alive) setVisiblePredictions(predictions);
      })
      .catch(() => {
        if (alive) setVisiblePredictions([]);
      })
      .finally(() => {
        if (alive) setVisiblePredictionsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [match?._id, match?.status, selectedLeagueId, language]);

  const loadMatch = async () => {
    try {
      const data = await fetchMatch(route.params.matchId);
      setMatch(data.match);
      setPrediction(data.prediction);
      if (data.prediction) {
        setHomeGoals(data.prediction.homeGoals);
        setAwayGoals(data.prediction.awayGoals);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!match) return;
    if (hasTbdTeam(match)) {
      Alert.alert(t('match.predictionsTbd'));
      return;
    }

    setSubmitting(true);
    try {
      const pred = await submitPrediction(match._id, homeGoals, awayGoals);
      setPrediction(pred);
      Alert.alert(t('match.saved'));
    } catch (err: any) {
      Alert.alert(t('common.error'), err.response?.data?.error || t('match.failedSave'));
    } finally {
      setSubmitting(false);
    }
  };

  const isLocked = match ? isPredictionLocked(match) : false;
  const teamsTbd = match ? hasTbdTeam(match) : false;
  const predictionDisabled = isLocked || teamsTbd;
  const lockStatus = match ? formatLockStatus(getPredictionLockTime(match), now, t) : null;
  const matchStarted = match ? isStarted(match) : false;
  const selectedLeague = leagues.find((league) => league._id === selectedLeagueId);
  const sortedVisiblePredictions = [...visiblePredictions].sort((a, b) => {
    const aUser = predictionUser(a);
    const bUser = predictionUser(b);
    if (aUser.id === currentUser?.id) return -1;
    if (bUser.id === currentUser?.id) return 1;
    return (aUser.name ?? '').localeCompare(bUser.name ?? '');
  });
  const pickSummary = visiblePredictions.reduce(
    (summary, item) => {
      summary[outcomeFor(item.homeGoals, item.awayGoals)] += 1;
      return summary;
    },
    { HOME: 0, DRAW: 0, AWAY: 0 },
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!match) {
    return (
      <View style={styles.center}>
        <Text>{t('match.notFound')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.matchHeader}>
        <Text style={styles.stage}>
          {match.stage.replace(/_/g, ' ')}{match.group ? ` - ${t('common.group', { group: match.group })}` : ''}
        </Text>
        <Text style={styles.date}>{format(new Date(match.utcDate), 'EEE, MMM d · HH:mm')}</Text>
        {match.status === 'LIVE' && (
          <Text style={styles.liveStatus}>{t('common.live')}</Text>
        )}
        {match.status === 'SCHEDULED' && !!lockStatus && (
          <Text style={[styles.lockStatus, isLocked && styles.lockStatusLocked]}>{lockStatus}</Text>
        )}
      </View>

      <View style={styles.teams}>
        <View style={styles.team}>
          <Text style={styles.teamCode}>{match.homeTeam.code}</Text>
          <Text style={styles.teamName}>{match.homeTeam.name}</Text>
        </View>
        <Text style={styles.vs}>
          {match.result ? `${match.result.homeGoals} - ${match.result.awayGoals}` : t('common.vs')}
        </Text>
        <View style={styles.team}>
          <Text style={styles.teamCode}>{match.awayTeam.code}</Text>
          <Text style={styles.teamName}>{match.awayTeam.name}</Text>
        </View>
      </View>

      {match.odds && match.status !== 'FINISHED' && (
        <View style={styles.oddsSection}>
          <Text style={styles.oddsSectionTitle}>{t('match.bettingOdds')}</Text>
          <View style={styles.oddsColumns}>
            <View style={styles.oddsCol}>
              <Text style={styles.oddsTeam}>{match.homeTeam.code}</Text>
              <Text style={styles.oddsNum}>{match.odds.home?.toFixed(2)}</Text>
            </View>
            <View style={styles.oddsColDivider} />
            <View style={styles.oddsCol}>
              <Text style={styles.oddsTeam}>X</Text>
              <Text style={styles.oddsNum}>{match.odds.draw?.toFixed(2)}</Text>
            </View>
            <View style={styles.oddsColDivider} />
            <View style={styles.oddsCol}>
              <Text style={styles.oddsTeam}>{match.awayTeam.code}</Text>
              <Text style={styles.oddsNum}>{match.odds.away?.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Prediction section */}
      <View style={styles.predictionSection}>
        <Text style={styles.sectionTitle}>
          {predictionDisabled ? t('match.yourPrediction') : t('match.makePrediction')}
        </Text>

        {prediction?.points != null && (
          <View style={styles.pointsBadge}>
            <Text style={styles.pointsText}>+{prediction.points} {t('common.pointsShort')}</Text>
          </View>
        )}

        <View style={styles.scoreInput}>
          <View style={styles.scoreColumn}>
            <Text style={styles.scoreLabel}>{match.homeTeam.code}</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => setHomeGoals(Math.max(0, homeGoals - 1))}
                disabled={predictionDisabled}
              >
                <Text style={styles.stepText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.scoreValue}>{homeGoals}</Text>
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => setHomeGoals(Math.min(15, homeGoals + 1))}
                disabled={predictionDisabled}
              >
                <Text style={styles.stepText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.scoreDash}>–</Text>

          <View style={styles.scoreColumn}>
            <Text style={styles.scoreLabel}>{match.awayTeam.code}</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => setAwayGoals(Math.max(0, awayGoals - 1))}
                disabled={predictionDisabled}
              >
                <Text style={styles.stepText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.scoreValue}>{awayGoals}</Text>
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => setAwayGoals(Math.min(15, awayGoals + 1))}
                disabled={predictionDisabled}
              >
                <Text style={styles.stepText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {!predictionDisabled && (
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>{prediction ? t('match.updatePrediction') : t('match.submitPrediction')}</Text>
            )}
          </TouchableOpacity>
        )}

        {predictionDisabled && !prediction && (
          <Text style={styles.lockedText}>
            {teamsTbd ? t('match.predictionsTbd') : t('match.locked')}
          </Text>
        )}
        {isLocked && prediction && (
          <Text style={styles.lockedText}>{t('match.locked')}</Text>
        )}
      </View>

      <View style={styles.friendsSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('match.friendPicks')}</Text>
          {matchStarted && selectedLeague ? (
            <Text style={styles.sectionMeta}>{selectedLeague.name}</Text>
          ) : null}
        </View>

        {!matchStarted ? (
          <Text style={styles.friendsHint}>{t('match.friendPicksLocked')}</Text>
        ) : leagues.length === 0 ? (
          <Text style={styles.friendsHint}>{t('match.friendPicksNoLeague')}</Text>
        ) : (
          <>
            {leagues.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.leagueTabs}>
                {leagues.map((league) => (
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

            {visiblePredictionsLoading ? (
              <View style={styles.friendsLoading}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : visiblePredictions.length === 0 ? (
              <Text style={styles.friendsHint}>{t('match.friendPicksEmpty')}</Text>
            ) : (
              <>
                <View style={styles.pickSummary}>
                  <View style={styles.pickSummaryItem}>
                    <Text style={styles.pickSummaryValue}>{pickSummary.HOME}</Text>
                    <Text style={styles.pickSummaryLabel}>{match.homeTeam.code}</Text>
                  </View>
                  <View style={styles.pickSummaryItem}>
                    <Text style={styles.pickSummaryValue}>{pickSummary.DRAW}</Text>
                    <Text style={styles.pickSummaryLabel}>X</Text>
                  </View>
                  <View style={styles.pickSummaryItem}>
                    <Text style={styles.pickSummaryValue}>{pickSummary.AWAY}</Text>
                    <Text style={styles.pickSummaryLabel}>{match.awayTeam.code}</Text>
                  </View>
                </View>

                <View style={styles.friendRows}>
                  {sortedVisiblePredictions.map((item) => {
                    const user = predictionUser(item);
                    const isMe = user.id === currentUser?.id;
                    return (
                      <View key={item._id} style={styles.friendRow}>
                        <Avatar name={user.name ?? 'Player'} imageUrl={user.avatarUrl} size={34} color={isMe ? colors.accent : colors.blue} />
                        <View style={styles.friendTextBlock}>
                          <Text style={styles.friendName}>
                            {isMe ? t('common.you') : user.name ?? 'Player'}
                          </Text>
                          <Text style={styles.friendOutcome}>
                            {outcomeFor(item.homeGoals, item.awayGoals) === 'DRAW'
                              ? t('match.friendPickDraw')
                              : t('match.friendPickWinner', {
                                  code: outcomeFor(item.homeGoals, item.awayGoals) === 'HOME'
                                    ? match.homeTeam.code
                                    : match.awayTeam.code,
                                })}
                          </Text>
                        </View>
                        <Text style={styles.friendScore}>{item.homeGoals} - {item.awayGoals}</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  matchHeader: { alignItems: 'center', padding: spacing.lg, backgroundColor: colors.primary },
  stage: { color: colors.accent, fontSize: fontSize.sm, fontWeight: '600', textTransform: 'uppercase' },
  date: { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.sm, marginTop: spacing.xs },
  liveStatus: {
    color: colors.warning,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  lockStatus: {
    color: colors.accent,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  lockStatusLocked: { color: colors.warning },
  teams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: colors.surface },
  team: { flex: 1, alignItems: 'center' },
  teamCode: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.text },
  teamName: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
  vs: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textSecondary, marginHorizontal: spacing.md },
  predictionSection: { padding: spacing.lg },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  pointsBadge: { backgroundColor: colors.success, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full, alignSelf: 'flex-start', marginBottom: spacing.md },
  pointsText: { color: '#fff', fontWeight: '700', fontSize: fontSize.sm },
  scoreInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  scoreColumn: { alignItems: 'center', flex: 1 },
  scoreLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border },
  stepButton: { padding: spacing.md, width: 48, alignItems: 'center' },
  stepText: { fontSize: fontSize.xl, color: colors.primary, fontWeight: '600' },
  scoreValue: { fontSize: fontSize.xxl, fontWeight: '800', paddingHorizontal: spacing.md, minWidth: 48, textAlign: 'center' },
  scoreDash: { fontSize: fontSize.xl, color: colors.textLight, marginHorizontal: spacing.sm },
  submitButton: { backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: 10, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: fontSize.md, fontWeight: '600' },
  lockedText: { color: colors.textSecondary, textAlign: 'center', fontStyle: 'italic' },
  friendsSection: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionMeta: {
    color: colors.dim,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  friendsHint: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  friendsLoading: {
    paddingVertical: spacing.lg,
  },
  leagueTabs: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  leagueTab: {
    borderWidth: 1,
    borderColor: colors.borderMid,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  leagueTabActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  leagueTabText: {
    color: colors.textSecondary,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  leagueTabTextActive: {
    color: colors.text,
  },
  pickSummary: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  pickSummaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.card2,
  },
  pickSummaryValue: {
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xl,
    fontWeight: '800',
  },
  pickSummaryLabel: {
    color: colors.muted,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.xs,
    fontWeight: '700',
    marginTop: 2,
  },
  friendRows: {
    marginTop: spacing.xs,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
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
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  friendOutcome: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  friendScore: {
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: fontSize.xl,
    fontWeight: '800',
  },
  oddsSection: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  oddsSectionTitle: {
    color: colors.muted,
    fontSize: fontSize.xs,
    fontFamily: fonts.bodyMedium,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  oddsColumns: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  oddsCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  oddsColDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  oddsTeam: {
    color: colors.muted,
    fontSize: fontSize.xs,
    fontFamily: fonts.bodyMedium,
    fontWeight: '600',
  },
  oddsNum: {
    color: colors.text,
    fontSize: fontSize.lg,
    fontFamily: fonts.displayBold,
    fontWeight: '700',
  },
});

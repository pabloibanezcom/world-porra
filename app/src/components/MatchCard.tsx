import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Match, MatchStage, Prediction } from '../types';
import Flag from './ui/Flag';
import Badge from './ui/Badge';
import { colors, fonts } from '../theme';
import { useI18n } from '../i18n';
import { useScrollTriggerContext } from '../contexts/ScrollTrigger';
import LiveBadge from './LiveBadge';
import PredictBadge from './PredictBadge';
import { getPredictionLockTime } from '../utils/prediction';
import { formatDurationShort } from '../utils/deadline';

export function oddsToPercents(home: number | null, draw: number | null, away: number | null) {
  if (!home || !draw || !away) return null;
  const rh = 1 / home, rd = 1 / draw, ra = 1 / away;
  const total = rh + rd + ra;
  return {
    h: Math.round((rh / total) * 100),
    d: Math.round((rd / total) * 100),
    a: Math.round((ra / total) * 100),
  };
}

export function knockoutOddsToPercents(home: number | null, away: number | null) {
  if (!home || !away) return null;
  const rh = 1 / home, ra = 1 / away;
  const total = rh + ra;
  return {
    h: Math.round((rh / total) * 100),
    a: Math.round((ra / total) * 100),
  };
}

export const KNOCKOUT_STAGES = new Set<MatchStage>([
  'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL',
]);

export function isKnockoutStage(stage: MatchStage): boolean {
  return KNOCKOUT_STAGES.has(stage);
}

interface OddsBarProps {
  pct: { h: number; d: number; a: number };
  homeColor: string;
  awayColor: string;
  homeLabel: string;
  awayLabel: string;
  visible: boolean;
}

interface KnockoutOddsBarProps {
  pct: { h: number; a: number };
  homeColor: string;
  awayColor: string;
  homeLabel: string;
  awayLabel: string;
  visible: boolean;
}

export function OddsBar({ pct, homeColor, awayColor, homeLabel, awayLabel, visible }: OddsBarProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const labelOpacity = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    if (trackWidth === 0 || !visible) return;
    Animated.parallel([
      Animated.timing(progress, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(labelOpacity, {
        toValue: 1,
        duration: 400,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [trackWidth, visible]);

  const GAP = 1.5;
  const homeWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, (trackWidth * pct.h) / 100 - GAP)],
  });
  const awayWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, (trackWidth * pct.a) / 100 - GAP)],
  });

  return (
    <View style={styles.oddsBar}>
      <Animated.View style={[styles.oddsLabels, { opacity: labelOpacity }]}>
        <Text style={[styles.oddsLabelTeam, { color: homeColor }]}>{homeLabel} {pct.h}%</Text>
        <Text style={styles.oddsLabelDraw}>Draw {pct.d}%</Text>
        <Text style={[styles.oddsLabelTeam, { color: awayColor }]}>{pct.a}% {awayLabel}</Text>
      </Animated.View>
      <View
        style={styles.oddsTrack}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View style={[styles.oddsSegmentHome, { width: homeWidth, backgroundColor: homeColor }]} />
        <View style={[styles.oddsSegmentDraw, { flex: 1 }]} />
        <Animated.View style={[styles.oddsSegmentAway, { width: awayWidth, backgroundColor: awayColor }]} />
      </View>
    </View>
  );
}

export function KnockoutOddsBar({ pct, homeColor, awayColor, homeLabel, awayLabel, visible }: KnockoutOddsBarProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const labelOpacity = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    if (trackWidth === 0 || !visible) return;
    Animated.parallel([
      Animated.timing(progress, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(labelOpacity, {
        toValue: 1,
        duration: 400,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [trackWidth, visible]);

  const homeWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, (trackWidth * pct.h) / 100 - 1)],
  });
  const awayWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, (trackWidth * pct.a) / 100 - 1)],
  });

  return (
    <View style={styles.oddsBar}>
      <Animated.View style={[styles.oddsLabels, { opacity: labelOpacity }]}>
        <Text style={[styles.oddsLabelTeam, { color: homeColor }]}>{homeLabel} {pct.h}%</Text>
        <Text style={styles.oddsLabelDraw}>Qualifying odds</Text>
        <Text style={[styles.oddsLabelTeam, { color: awayColor }]}>{pct.a}% {awayLabel}</Text>
      </Animated.View>
      <View
        style={styles.oddsTrack}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View style={[styles.oddsSegmentHome, { width: homeWidth, backgroundColor: homeColor }]} />
        <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
        <Animated.View style={[styles.oddsSegmentAway, { width: awayWidth, backgroundColor: awayColor }]} />
      </View>
    </View>
  );
}

type Result = 'exact' | 'correct' | 'wrong';
type MatchCardState = 'empty' | 'tbd' | 'predicted' | 'live' | 'finished';

interface Props {
  match: Match;
  prediction?: Prediction | null;
  result?: Result | null;
  locked?: boolean;
  lockLabel?: string | null;
  potentialPoints?: number | null;
  onPress?: () => void;
}

function formatDate(utcDate: string, locale: string) {
  return new Date(utcDate).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function formatTime(utcDate: string, locale: string) {
  return new Date(utcDate).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export function getTeamLabel(name: string, code?: string) {
  if (code && code.trim().length > 0) {
    return code.trim().toUpperCase();
  }

  return name.slice(0, 3).toUpperCase();
}

export function hasTbdTeam(match: Match) {
  return [match.homeTeam, match.awayTeam].some(
    (team) => team.code.trim().toUpperCase() === 'TBD' || team.name.trim().toUpperCase() === 'TBD',
  );
}

function getCardState(match: Match, prediction?: Prediction | null): MatchCardState {
  if (match.status === 'FINISHED') {
    return 'finished';
  }

  if (match.status === 'LIVE') {
    return 'live';
  }

  if (hasTbdTeam(match)) {
    return 'tbd';
  }

  return prediction ? 'predicted' : 'empty';
}

export default function MatchCard({ match, prediction, result, locked, lockLabel, potentialPoints, onPress }: Props) {
  const { t, locale } = useI18n();
  const ctx = useScrollTriggerContext();

  // Without a ScrollTriggerProvider, cards are always visible (no animation delay).
  const cardOpacity = useRef(new Animated.Value(ctx ? 0 : 1)).current;
  const cardSlide = useRef(new Animated.Value(ctx ? 14 : 0)).current;
  const viewRef = useRef<View>(null);
  const seen = useRef(false);
  const [visible, setVisible] = useState(!ctx);

  const checkVisibility = useCallback(() => {
    if (seen.current) return;
    viewRef.current?.measureInWindow((_x, y) => {
      const screenH = Dimensions.get('window').height;
      if (y < screenH - 60) {
        seen.current = true;
        setVisible(true);
      }
    });
  }, []);

  // Subscribe to scroll trigger
  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe(checkVisibility);
  }, [ctx, checkVisibility]);

  // Also check on layout (important for items that mount before they're scrolled to)
  const handleLayout = useCallback(() => {
    checkVisibility();
  }, [checkVisibility]);

  // Entrance animation when visible
  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(cardSlide, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible]);

  const state = getCardState(match, prediction);
  const isJoker = !!prediction?.joker;
  const knockout = isKnockoutStage(match.stage);
  const homeCode = getTeamLabel(match.homeTeam.name, match.homeTeam.code);
  const awayCode = getTeamLabel(match.awayTeam.name, match.awayTeam.code);

  const msToLock = getPredictionLockTime(match).getTime() - Date.now();
  const urgent = state === 'empty' && !locked && msToLock > 0 && msToLock < 24 * 60 * 60 * 1000;
  const countdownLabel = urgent ? t('matchCard.timeLeft', { time: formatDurationShort(msToLock) }) : undefined;

  const cardStyle =
    state === 'empty'
      ? urgent
        ? styles.cardEmptyUrgent
        : styles.cardEmpty
      : state === 'live'
      ? styles.cardLive
      : state === 'finished' && result === 'exact'
      ? styles.cardExact
      : state === 'finished' && result === 'correct'
      ? styles.cardCorrect
      : styles.cardBase;

  let action: React.ReactNode = null;
  if (state === 'empty') {
    action = locked ? (
      <Text style={styles.lockedBadge}>{t('deadline.locked')}</Text>
    ) : (
      <PredictBadge urgent={urgent} countdownLabel={countdownLabel} />
    );
  } else if (state === 'tbd') {
    action = <Text style={styles.tbdBadge}>{t('matchCard.teamsTbd')}</Text>;
  } else if (state === 'predicted') {
    // Knockout: warn if no qualifier set
    if (knockout && !prediction?.qualifier) {
      action = <Text style={styles.qualifierWarning}>{t('matchCard.pickQualifier')}</Text>;
    } else {
      action = (
        <View style={styles.predictedChip}>
          <Text style={styles.predictedChipText}>✓ {t('matchCard.predicted')}</Text>
        </View>
      );
    }
  } else if (state === 'live') {
    action = <LiveBadge />;
  } else if (result) {
    action = <Badge result={result} points={prediction?.points} />;
  } else if (state === 'finished' && !prediction) {
    action = <Badge result="wrong" />;
  } else {
    action = <Text style={styles.finalText}>{t('common.final')}</Text>;
  }

  // Qualifier display for predicted knockout matches
  const qualifierBadge = knockout && state === 'predicted' && prediction?.qualifier ? (
    <View style={styles.qualifierRow}>
      <Text style={styles.qualifierLabel}>
        {t('matchCard.advances', {
          code: prediction.qualifier === 'HOME' ? homeCode : awayCode,
        })}
      </Text>
    </View>
  ) : null;

  return (
    <Animated.View
      ref={viewRef}
      onLayout={handleLayout}
      style={{ opacity: cardOpacity, transform: [{ translateY: cardSlide }] }}
    >
      <TouchableOpacity
        style={[styles.card, cardStyle, isJoker && styles.cardJoker]}
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={0.85}
      >
        <View style={styles.header}>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>
              {match.group ? t('common.group', { group: match.group }) : t(`stage.${match.stage}`)} · {formatDate(match.utcDate, locale)}
              {' · '}{formatTime(match.utcDate, locale)}
            </Text>
            {isJoker && (
              <View style={styles.jokerBadge}>
                <Text style={styles.jokerBadgeText}>{t('matchCard.joker')}</Text>
              </View>
            )}
          </View>
          {action}
        </View>

        {!!lockLabel && match.status === 'SCHEDULED' && (
          <View style={styles.lockInfoRow}>
            <Text style={[styles.lockInfoText, locked && styles.lockInfoTextLocked]}>{lockLabel}</Text>
          </View>
        )}

        <View style={styles.matchRow}>
          <View style={styles.teamSide}>
            <Flag code={match.homeTeam.code} size={26} />
            <Text style={styles.teamCode}>{homeCode}</Text>
          </View>

          <View style={styles.scoreCenter}>
            {state === 'empty' ? (
              <Text style={styles.vsText}>{t('common.vs')}</Text>
            ) : state === 'tbd' ? (
              <Text style={styles.vsText}>{t('common.tbd')}</Text>
            ) : state === 'predicted' ? (
              <Text style={styles.predictedScore}>
                {prediction?.homeGoals} – {prediction?.awayGoals}
              </Text>
            ) : (
              <>
                {match.result ? (
                  <Text style={styles.resultScore}>
                    {match.result.homeGoals} – {match.result.awayGoals}
                  </Text>
                ) : (
                  <Text style={styles.scorePending}>{t('matchCard.scorePending')}</Text>
                )}
                {prediction ? (
                  <>
                    <Text style={styles.pickText}>
                      {t('common.pick')}: {prediction.homeGoals}–{prediction.awayGoals}
                    </Text>
                    {state === 'live' && potentialPoints != null && (
                      <Text style={styles.potentialPointsText}>
                        {t('matchCard.potentialPoints', { points: potentialPoints })}
                      </Text>
                    )}
                  </>
                ) : state === 'live' ? (
                  <Text style={styles.pickText}>{t('common.inProgress')}</Text>
                ) : state === 'finished' ? (
                  <Text style={styles.pickText}>{t('matchCard.noPrediction')}</Text>
                ) : null}
              </>
            )}
          </View>

          <View style={[styles.teamSide, styles.teamSideRight]}>
            <Text style={styles.teamCode}>{awayCode}</Text>
            <Flag code={match.awayTeam.code} size={26} />
          </View>
        </View>

        {qualifierBadge}

        {match.odds && state !== 'finished' && (() => {
          if (knockout) {
            const pct = knockoutOddsToPercents(match.odds.home, match.odds.away);
            if (!pct) return null;
            return (
              <KnockoutOddsBar
                pct={pct}
                homeColor={match.homeTeam.color || '#505a63'}
                awayColor={match.awayTeam.color || '#505a63'}
                homeLabel={homeCode}
                awayLabel={awayCode}
                visible={visible}
              />
            );
          }
          const pct = oddsToPercents(match.odds.home, match.odds.draw, match.odds.away);
          if (!pct) return null;
          return (
            <OddsBar
              pct={pct}
              homeColor={match.homeTeam.color || '#505a63'}
              awayColor={match.awayTeam.color || '#505a63'}
              homeLabel={homeCode}
              awayLabel={awayCode}
              visible={visible}
            />
          );
        })()}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    paddingHorizontal: 16,
  },
  cardBase: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  cardEmpty: {
    backgroundColor: 'rgba(73,79,223,0.07)',
    borderColor: 'rgba(73,79,223,0.22)',
  },
  cardEmptyUrgent: {
    backgroundColor: 'rgba(236,126,0,0.09)',
    borderColor: 'rgba(236,126,0,0.30)',
  },
  cardLive: {
    backgroundColor: 'rgba(236,126,0,0.10)',
    borderColor: 'rgba(236,126,0,0.32)',
  },
  cardExact: {
    backgroundColor: colors.card,
    borderColor: 'rgba(0,168,126,0.35)',
  },
  cardCorrect: {
    backgroundColor: colors.card,
    borderColor: 'rgba(73,79,223,0.28)',
  },
  cardJoker: {
    borderColor: colors.warning,
    borderWidth: 1.5,
    backgroundColor: 'rgba(236,126,0,0.07)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  meta: {
    color: colors.dim,
    fontSize: 10,
    fontFamily: fonts.body,
  },
  jokerBadge: {
    backgroundColor: 'rgba(236,126,0,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(236,126,0,0.4)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  jokerBadgeText: {
    color: colors.warning,
    fontSize: 9,
    fontWeight: '800',
    fontFamily: fonts.bodyMedium,
    letterSpacing: 0.4,
  },
  predictedChip: {
    backgroundColor: colors.accentDim,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  predictedChipText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.bodyMedium,
  },
  qualifierWarning: {
    color: 'rgba(236,126,0,0.9)',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
  },
  tbdBadge: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
  },
  lockedBadge: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fonts.bodyMedium,
  },
  lockInfoRow: {
    marginTop: -5,
    marginBottom: 10,
  },
  lockInfoText: {
    color: colors.muted,
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
  },
  lockInfoTextLocked: { color: colors.warning },
  finalText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  teamSideRight: {
    justifyContent: 'flex-end',
  },
  teamCode: {
    color: colors.text,
    fontSize: 17,
    fontFamily: fonts.displayBold,
    letterSpacing: 0.8,
  },
  scoreCenter: {
    alignItems: 'center',
    minWidth: 76,
    paddingHorizontal: 8,
  },
  predictedScore: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: fonts.displayBold,
  },
  resultScore: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: fonts.displayBold,
  },
  scorePending: {
    color: colors.dim,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.displayBold,
    textTransform: 'uppercase',
  },
  pickText: {
    color: colors.dim,
    fontSize: 11,
    marginTop: 2,
    fontFamily: fonts.body,
  },
  potentialPointsText: {
    color: colors.danger,
    fontSize: 10,
    marginTop: 1,
    fontFamily: fonts.bodyMedium,
    fontWeight: '800',
  },
  vsText: {
    color: colors.dim,
    fontSize: 14,
    fontFamily: fonts.body,
  },
  qualifierRow: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 2,
  },
  qualifierLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
  },
  oddsBar: {
    marginTop: 10,
  },
  oddsLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  oddsLabelTeam: {
    fontSize: 10,
    fontWeight: '600',
    fontFamily: fonts.bodyMedium,
  },
  oddsLabelDraw: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.dim,
    fontFamily: fonts.bodyMedium,
  },
  oddsTrack: {
    height: 5,
    borderRadius: 9999,
    overflow: 'hidden',
    flexDirection: 'row',
    gap: 1.5,
    backgroundColor: colors.bg,
  },
  oddsSegmentHome: {
    height: '100%',
    borderTopLeftRadius: 9999,
    borderBottomLeftRadius: 9999,
    opacity: 0.85,
  },
  oddsSegmentDraw: {
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  oddsSegmentAway: {
    height: '100%',
    borderTopRightRadius: 9999,
    borderBottomRightRadius: 9999,
    opacity: 0.85,
  },
});

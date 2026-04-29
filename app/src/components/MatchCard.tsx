import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Match, Prediction } from '../types';
import Flag from './ui/Flag';
import Badge from './ui/Badge';
import { colors, fonts } from '../theme';
import { useI18n } from '../i18n';

function oddsToPercents(home: number | null, draw: number | null, away: number | null) {
  if (!home || !draw || !away) return null;
  const rh = 1 / home, rd = 1 / draw, ra = 1 / away;
  const total = rh + rd + ra;
  return {
    h: Math.round((rh / total) * 100),
    d: Math.round((rd / total) * 100),
    a: Math.round((ra / total) * 100),
  };
}

type Result = 'exact' | 'correct' | 'wrong';
type MatchCardState = 'empty' | 'tbd' | 'predicted' | 'live' | 'finished';

interface Props {
  match: Match;
  prediction?: Prediction | null;
  result?: Result | null;
  onPress?: () => void;
}

function formatDate(utcDate: string, locale: string) {
  return new Date(utcDate).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function formatTime(utcDate: string, locale: string) {
  return new Date(utcDate).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function getTeamLabel(name: string, code?: string) {
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

export default function MatchCard({ match, prediction, result, onPress }: Props) {
  const { t, locale } = useI18n();
  const state = getCardState(match, prediction);
  const cardStyle =
    state === 'empty'
      ? styles.cardEmpty
      : state === 'live'
      ? styles.cardLive
      : state === 'finished' && result === 'exact'
      ? styles.cardExact
      : state === 'finished' && result === 'correct'
      ? styles.cardCorrect
      : styles.cardBase;

  let action: React.ReactNode = null;
  if (state === 'empty') {
    action = (
      <View style={styles.predictBtn}>
        <Text style={styles.predictBtnText}>{t('matchCard.predict')}</Text>
      </View>
    );
  } else if (state === 'tbd') {
    action = <Text style={styles.tbdBadge}>{t('matchCard.teamsTbd')}</Text>;
  } else if (state === 'predicted') {
    action = <Text style={styles.predictedBadge}>✓ {t('matchCard.predicted')}</Text>;
  } else if (state === 'live') {
    action = (
      <View style={styles.livePill}>
        <Text style={styles.liveText}>{t('common.live')}</Text>
      </View>
    );
  } else if (result) {
    action = <Badge result={result} />;
  } else {
    action = <Text style={styles.finalText}>{t('common.final')}</Text>;
  }

  return (
    <TouchableOpacity
      style={[styles.card, cardStyle]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.85}
    >
      <View style={styles.header}>
        <Text style={styles.meta}>
          {match.group ? t('common.group', { group: match.group }) : match.stage} · {formatDate(match.utcDate, locale)}
          {(state === 'empty' || state === 'predicted') ? ` · ${formatTime(match.utcDate, locale)}` : ''}
        </Text>
        {action}
      </View>

      <View style={styles.matchRow}>
        <View style={styles.teamSide}>
          <Flag code={match.homeTeam.code} size={26} />
          <Text style={styles.teamCode}>{getTeamLabel(match.homeTeam.name, match.homeTeam.code)}</Text>
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
              <Text style={styles.resultScore}>
                {match.result?.homeGoals ?? '?'} – {match.result?.awayGoals ?? '?'}
              </Text>
              {prediction ? (
                <Text style={styles.pickText}>
                  {t('common.pick')}: {prediction.homeGoals}–{prediction.awayGoals}
                </Text>
              ) : state === 'live' ? (
                <Text style={styles.pickText}>{t('common.inProgress')}</Text>
              ) : null}
            </>
          )}
        </View>

        <View style={[styles.teamSide, styles.teamSideRight]}>
          <Text style={styles.teamCode}>{getTeamLabel(match.awayTeam.name, match.awayTeam.code)}</Text>
          <Flag code={match.awayTeam.code} size={26} />
        </View>
      </View>

      {match.odds && state !== 'finished' && (() => {
        const pct = oddsToPercents(match.odds.home, match.odds.draw, match.odds.away);
        if (!pct) return null;
        const hc = match.homeTeam.color || '#505a63';
        const ac = match.awayTeam.color || '#505a63';
        const homeLabel = getTeamLabel(match.homeTeam.name, match.homeTeam.code);
        const awayLabel = getTeamLabel(match.awayTeam.name, match.awayTeam.code);
        return (
          <View style={styles.oddsBar}>
            <View style={styles.oddsLabels}>
              <Text style={[styles.oddsLabelTeam, { color: hc }]}>{homeLabel} {pct.h}%</Text>
              <Text style={styles.oddsLabelDraw}>Draw {pct.d}%</Text>
              <Text style={[styles.oddsLabelTeam, { color: ac }]}>{pct.a}% {awayLabel}</Text>
            </View>
            <View style={styles.oddsTrack}>
              <View style={[styles.oddsSegmentHome, { width: `${pct.h}%`, backgroundColor: hc }]} />
              <View style={[styles.oddsSegmentDraw, { flex: 1 }]} />
              <View style={[styles.oddsSegmentAway, { width: `${pct.a}%`, backgroundColor: ac }]} />
            </View>
          </View>
        );
      })()}
    </TouchableOpacity>
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
    backgroundColor: 'rgba(0,168,126,0.08)',
    borderColor: 'rgba(0,168,126,0.28)',
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  meta: {
    color: colors.dim,
    fontSize: 10,
    fontFamily: fonts.body,
  },
  predictBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  predictBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  predictedBadge: {
    color: colors.accent,
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
  livePill: {
    backgroundColor: 'rgba(226,59,74,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fonts.bodyMedium,
  },
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
    fontFamily: fonts.bodyMedium,
  },
  resultScore: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: fonts.bodyMedium,
  },
  pickText: {
    color: colors.dim,
    fontSize: 11,
    marginTop: 2,
    fontFamily: fonts.body,
  },
  vsText: {
    color: colors.dim,
    fontSize: 14,
    fontFamily: fonts.body,
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

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Match, Prediction } from '../types';
import Flag from './ui/Flag';
import Badge from './ui/Badge';
import { colors, fonts } from '../theme';
import { useI18n } from '../i18n';

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

      {match.odds && state !== 'finished' && (
        <View style={styles.oddsRow}>
          <Text style={styles.oddsItem}>
            <Text style={styles.oddsLabel}>{getTeamLabel(match.homeTeam.name, match.homeTeam.code)} </Text>
            <Text style={styles.oddsValue}>{match.odds.home?.toFixed(2)}</Text>
          </Text>
          <Text style={styles.oddsSep}>·</Text>
          <Text style={styles.oddsItem}>
            <Text style={styles.oddsLabel}>X </Text>
            <Text style={styles.oddsValue}>{match.odds.draw?.toFixed(2)}</Text>
          </Text>
          <Text style={styles.oddsSep}>·</Text>
          <Text style={styles.oddsItem}>
            <Text style={styles.oddsLabel}>{getTeamLabel(match.awayTeam.name, match.awayTeam.code)} </Text>
            <Text style={styles.oddsValue}>{match.odds.away?.toFixed(2)}</Text>
          </Text>
        </View>
      )}
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
  oddsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  oddsItem: {
    fontSize: 10,
  },
  oddsLabel: {
    color: colors.dim,
    fontFamily: fonts.body,
  },
  oddsValue: {
    color: colors.muted,
    fontFamily: fonts.bodyMedium,
  },
  oddsSep: {
    color: colors.dim,
    fontSize: 10,
  },
});

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Match, Prediction } from '../types';
import Flag from './ui/Flag';
import Badge from './ui/Badge';
import { colors, fonts } from '../theme';

type Result = 'exact' | 'correct' | 'wrong';
type MatchCardState = 'empty' | 'predicted' | 'live' | 'finished';

interface Props {
  match: Match;
  prediction?: Prediction | null;
  result?: Result | null;
  onPress?: () => void;
}

function formatDate(utcDate: string) {
  return new Date(utcDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(utcDate: string) {
  return new Date(utcDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function getTeamLabel(name: string, code?: string) {
  if (code && code.trim().length > 0) {
    return code.trim().toUpperCase();
  }

  return name.slice(0, 3).toUpperCase();
}

function getCardState(match: Match, prediction?: Prediction | null): MatchCardState {
  if (match.status === 'FINISHED') {
    return 'finished';
  }

  if (match.status === 'LIVE') {
    return 'live';
  }

  return prediction ? 'predicted' : 'empty';
}

export default function MatchCard({ match, prediction, result, onPress }: Props) {
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
        <Text style={styles.predictBtnText}>Predict →</Text>
      </View>
    );
  } else if (state === 'predicted') {
    action = <Text style={styles.predictedBadge}>✓ Predicted</Text>;
  } else if (state === 'live') {
    action = (
      <View style={styles.livePill}>
        <Text style={styles.liveText}>LIVE</Text>
      </View>
    );
  } else if (result) {
    action = <Badge result={result} />;
  } else {
    action = <Text style={styles.finalText}>Final</Text>;
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
          {match.group ? `Group ${match.group}` : match.stage} · {formatDate(match.utcDate)}
          {(state === 'empty' || state === 'predicted') ? ` · ${formatTime(match.utcDate)}` : ''}
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
            <Text style={styles.vsText}>vs</Text>
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
                  pick: {prediction.homeGoals}–{prediction.awayGoals}
                </Text>
              ) : state === 'live' ? (
                <Text style={styles.pickText}>in progress</Text>
              ) : null}
            </>
          )}
        </View>

        <View style={[styles.teamSide, styles.teamSideRight]}>
          <Text style={styles.teamCode}>{getTeamLabel(match.awayTeam.name, match.awayTeam.code)}</Text>
          <Flag code={match.awayTeam.code} size={26} />
        </View>
      </View>
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
    borderRadius: 9999,
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
  livePill: {
    backgroundColor: 'rgba(226,59,74,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
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
});

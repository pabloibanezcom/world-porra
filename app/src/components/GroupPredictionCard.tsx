import React, { useMemo, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { GroupPrediction, TeamInfo } from '../types';
import Flag from './ui/Flag';
import { colors, fonts } from '../theme';
import { useI18n } from '../i18n';

interface GroupPredictionCardProps {
  group: {
    id: string;
    teams: TeamInfo[];
  };
  order: TeamInfo[];
  points?: number | null;
  progress?: GroupPrediction['progress'];
  onOrderChange?: (groupId: string, orderedTeams: TeamInfo[]) => void;
  onDragStateChange: (isDragging: boolean) => void;
}

export default function GroupPredictionCard({
  group,
  order,
  points,
  progress,
  onOrderChange,
  onDragStateChange,
}: GroupPredictionCardProps) {
  const { t } = useI18n();
  const progressByCode = new Map(progress?.teams.map((team) => [team.code, team]) ?? []);
  const hasAwardedPoints = points !== null && points !== undefined;
  const displayedPoints = hasAwardedPoints ? points : progress?.projectedPoints;
  const moveTeam = (index: number, targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= order.length || targetIndex === index) return;
    if (!onOrderChange) return;
    const next = [...order];
    const [team] = next.splice(index, 1);
    next.splice(targetIndex, 0, team);
    onOrderChange(group.id, next);
  };

  return (
    <View style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupTitle}>{t('common.group', { group: group.id })}</Text>
        {displayedPoints !== null && displayedPoints !== undefined && (
          <View style={[styles.groupPointsPill, hasAwardedPoints ? styles.groupPointsPillAwarded : styles.groupPointsPillProjected]}>
            <Text style={[styles.groupPointsLabel, hasAwardedPoints ? styles.groupPointsLabelAwarded : styles.groupPointsLabelProjected]}>
              {hasAwardedPoints ? t('groupPrediction.awarded') : t('groupPrediction.projected')}
            </Text>
            <Text style={[styles.groupPointsText, hasAwardedPoints ? styles.groupPointsTextAwarded : styles.groupPointsTextProjected]}>
              {displayedPoints} {t('common.pointsShort')}
            </Text>
          </View>
        )}
      </View>

      {order.map((team, index) => {
        const qualifies = index < 2;
        const potentialQualifier = index === 2;

        return (
          <DraggableGroupTeamRow
            key={team.code}
            team={team}
            progress={progressByCode.get(team.code)}
            index={index}
            count={order.length}
            qualifies={qualifies}
            potentialQualifier={potentialQualifier}
            onMove={moveTeam}
            onDragStateChange={onDragStateChange}
            disabled={!onOrderChange}
          />
        );
      })}
    </View>
  );
}

const GROUP_ROW_HEIGHT = 52;

function DraggableGroupTeamRow({
  team,
  progress,
  index,
  count,
  qualifies,
  potentialQualifier,
  onMove,
  onDragStateChange,
  disabled,
}: {
  team: TeamInfo;
  progress?: NonNullable<GroupPrediction['progress']>['teams'][number];
  index: number;
  count: number;
  qualifies: boolean;
  potentialQualifier: boolean;
  onMove: (fromIndex: number, toIndex: number) => void;
  onDragStateChange: (isDragging: boolean) => void;
  disabled?: boolean;
}) {
  const translateY = React.useRef(new Animated.Value(0)).current;
  const [isDragging, setIsDragging] = useState(false);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: (_event, gesture) => !disabled && Math.abs(gesture.dy) > 2,
        onPanResponderGrant: () => {
          setIsDragging(true);
          onDragStateChange(true);
          translateY.setValue(0);
        },
        onPanResponderMove: (_event, gesture) => {
          const minY = -index * GROUP_ROW_HEIGHT;
          const maxY = (count - index - 1) * GROUP_ROW_HEIGHT;
          translateY.setValue(Math.max(minY, Math.min(maxY, gesture.dy)));
        },
        onPanResponderRelease: (_event, gesture) => {
          const offset = Math.round(gesture.dy / GROUP_ROW_HEIGHT);
          const nextIndex = Math.max(0, Math.min(count - 1, index + offset));
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            speed: 22,
            bounciness: 0,
          }).start(() => {
            setIsDragging(false);
            onDragStateChange(false);
            onMove(index, nextIndex);
          });
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            speed: 22,
            bounciness: 0,
          }).start(() => {
            setIsDragging(false);
            onDragStateChange(false);
          });
        },
      }),
    [count, disabled, index, onDragStateChange, onMove, translateY],
  );

  return (
    <Animated.View
      style={[
        styles.groupTeamRow,
        index < count - 1 && styles.groupTeamBorder,
        qualifies && styles.groupTeamQualifies,
        potentialQualifier && styles.groupTeamPotential,
        isDragging && styles.groupTeamDragging,
        { transform: [{ translateY }] },
      ]}
    >
      <Text
        style={[
          styles.positionLabel,
          qualifies && styles.positionLabelQualifies,
          potentialQualifier && styles.positionLabelPotential,
        ]}
      >
        {index + 1}
      </Text>
      <Flag code={team.code} size={22} />
      <Text
        style={[
          styles.groupTeamName,
          !qualifies && !potentialQualifier && styles.groupTeamNameDim,
        ]}
        numberOfLines={1}
      >
        {team.name}
      </Text>
      {progress?.currentPosition && (
        <View style={[
          styles.groupProgressBadge,
          progress.status === 'exact' && styles.groupProgressBadgeExact,
          progress.status === 'qualified' && styles.groupProgressBadgeQualified,
        ]}>
          <Text style={[
            styles.groupProgressText,
            progress.status === 'exact' && styles.groupProgressTextExact,
            progress.status === 'qualified' && styles.groupProgressTextQualified,
          ]}>
            #{progress.currentPosition} · +{progress.points}
          </Text>
        </View>
      )}
      {!disabled && (
        <View style={styles.dragHandle} {...panResponder.panHandlers}>
          <View style={styles.dragHandleLine} />
          <View style={styles.dragHandleLine} />
          <View style={styles.dragHandleLine} />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  groupCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  groupHeader: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  groupTitle: {
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 15,
    fontWeight: '700',
  },
  groupPointsPill: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    alignItems: 'flex-end',
  },
  groupPointsPillAwarded: {
    backgroundColor: colors.accentDim,
  },
  groupPointsPillProjected: {
    backgroundColor: colors.blueDim,
  },
  groupPointsLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  groupPointsLabelAwarded: {
    color: colors.accent,
  },
  groupPointsLabelProjected: {
    color: colors.blue,
  },
  groupPointsText: {
    fontFamily: fonts.displayBold,
    fontSize: 12,
    fontWeight: '700',
  },
  groupPointsTextAwarded: {
    color: colors.accent,
  },
  groupPointsTextProjected: {
    color: colors.blue,
  },
  groupTeamRow: {
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  groupTeamQualifies: {
    backgroundColor: 'rgba(0,168,126,0.04)',
    borderLeftColor: 'rgba(0,168,126,0.35)',
  },
  groupTeamPotential: {
    backgroundColor: 'rgba(73,79,223,0.06)',
    borderLeftColor: 'rgba(73,79,223,0.24)',
  },
  groupTeamBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  positionLabel: {
    color: colors.dim,
    fontFamily: fonts.displayBold,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    width: 24,
  },
  positionLabelQualifies: {
    color: colors.accent,
  },
  positionLabelPotential: {
    color: colors.blue,
  },
  groupTeamName: {
    color: colors.text,
    flex: 1,
    fontFamily: fonts.displayBold,
    fontSize: 13,
    fontWeight: '600',
  },
  groupTeamNameDim: {
    color: colors.muted,
  },
  groupProgressBadge: {
    backgroundColor: colors.card2,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  groupProgressBadgeExact: {
    backgroundColor: colors.accentDim,
  },
  groupProgressBadgeQualified: {
    backgroundColor: colors.blueDim,
  },
  groupProgressText: {
    color: colors.dim,
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    fontWeight: '700',
  },
  groupProgressTextExact: {
    color: colors.accent,
  },
  groupProgressTextQualified: {
    color: colors.blue,
  },
  groupTeamDragging: {
    backgroundColor: colors.card2,
    elevation: 2,
    position: 'relative',
    zIndex: 5,
  },
  dragHandle: {
    alignItems: 'center',
    borderRadius: 8,
    gap: 3,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  dragHandleLine: {
    backgroundColor: colors.dim,
    borderRadius: 1,
    height: 1.5,
    width: 14,
  },
});

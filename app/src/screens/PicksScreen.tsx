import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ScrollTriggerProvider } from '../contexts/ScrollTrigger';
import {
  Animated,
  PanResponder,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { fetchMatches } from '../api/matches';
import {
  fetchMyGroupPredictions,
  fetchMyPredictions,
  fetchTournamentPrediction,
  saveTournamentPrediction,
  submitGroupPrediction,
  submitPrediction,
} from '../api/predictions';
import { GroupPrediction, Match, Prediction, TeamInfo } from '../types';
import PredictionSheet from '../components/PredictionSheet';
import MatchCard, { hasTbdTeam } from '../components/MatchCard';
import LoadingView from '../components/ui/LoadingView';
import Flag from '../components/ui/Flag';
import TournamentPicksSection from '../components/TournamentPicksSection';
import { TournamentPicks, PlayerOption, TeamOption } from '../data/tournamentData';
import { colors, fonts } from '../theme';
import { useI18n } from '../i18n';

function getResult(pred: Prediction, match: Match): 'exact' | 'correct' | 'wrong' | null {
  if (!match.result) return null;
  const { homeGoals, awayGoals } = match.result;
  if (pred.homeGoals === homeGoals && pred.awayGoals === awayGoals) return 'exact';
  const pOut = pred.homeGoals > pred.awayGoals ? 'h' : pred.homeGoals < pred.awayGoals ? 'a' : 'd';
  const aOut = homeGoals > awayGoals ? 'h' : homeGoals < awayGoals ? 'a' : 'd';
  return pOut === aOut ? 'correct' : 'wrong';
}

function getDayKey(utcDate: string) {
  const date = new Date(utcDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDayLabel(utcDate: string, locale: string) {
  return new Date(utcDate).toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function groupMatchesByDay(matches: Match[], locale: string) {
  const groups = new Map<string, Match[]>();

  matches.forEach((match) => {
    const key = getDayKey(match.utcDate);
    groups.set(key, [...(groups.get(key) ?? []), match]);
  });

  return Array.from(groups.entries()).map(([day, dayMatches]) => ({
    day,
    label: formatDayLabel(dayMatches[0].utcDate, locale),
    matches: dayMatches,
  }));
}

interface GroupStanding {
  id: string;
  teams: TeamInfo[];
}

const PICK_TABS = ['upcoming', 'results', 'groups', 'finals'] as const;
type PicksTab = typeof PICK_TABS[number];

function isTbdTeam(team: TeamInfo) {
  return team.code.trim().toUpperCase() === 'TBD' || team.name.trim().toUpperCase() === 'TBD';
}

function getGroupsFromMatches(matches: Match[]): GroupStanding[] {
  const groups = new Map<string, Map<string, TeamInfo>>();

  matches.forEach((match) => {
    if (match.stage !== 'GROUP' || !match.group) return;

    const group = groups.get(match.group) ?? new Map<string, TeamInfo>();
    [match.homeTeam, match.awayTeam].forEach((team) => {
      const code = team.code.trim().toUpperCase();
      if (code && !isTbdTeam(team)) {
        group.set(code, { ...team, code });
      }
    });
    groups.set(match.group, group);
  });

  return Array.from(groups.entries())
    .map(([id, teams]) => ({
      id,
      teams: Array.from(teams.values()).sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((group) => group.teams.length >= 2)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export default function PicksScreen() {
  const { language, t, locale } = useI18n();
  const scrollRef = useRef<ScrollView>(null);
  const triggerRef = useRef<() => void>(() => {});
  const tabAnimation = useRef(new Animated.Value(0)).current;
  const [tab, setTab] = useState<PicksTab>('upcoming');
  const [tabBarWidth, setTabBarWidth] = useState(0);
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [groupPredictions, setGroupPredictions] = useState<GroupPrediction[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDraggingGroupTeam, setIsDraggingGroupTeam] = useState(false);

  const [tournamentPicks, setTournamentPicks] = useState<TournamentPicks>({});

  const predMap = Object.fromEntries(predictions.map((p) => [p.matchId, p]));
  const groupPredMap = Object.fromEntries(groupPredictions.map((p) => [p.group, p]));

  const load = useCallback(async () => {
    try {
      const [m, p, gp] = await Promise.all([
        fetchMatches({}),
        fetchMyPredictions(),
        fetchMyGroupPredictions(),
      ]);
      setMatches(m);
      setPredictions(p);
      setGroupPredictions(gp);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [language]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    fetchTournamentPrediction().then(setTournamentPicks).catch(() => {});
  }, [language]);

  const handleTournamentPick = useCallback(
    (key: keyof TournamentPicks, value: TeamOption | PlayerOption) => {
      setTournamentPicks((prev) => {
        const next = { ...prev, [key]: value };
        saveTournamentPrediction(next).catch(() => {});
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    Animated.spring(tabAnimation, {
      toValue: PICK_TABS.indexOf(tab),
      useNativeDriver: true,
      speed: 22,
      bounciness: 4,
    }).start();
  }, [tab, tabAnimation]);

  const tabIndicatorWidth = tabBarWidth > 0 ? (tabBarWidth - 8) / PICK_TABS.length : 0;
  const tabIndicatorTranslate = tabAnimation.interpolate({
    inputRange: PICK_TABS.map((_, index) => index),
    outputRange: PICK_TABS.map((_, index) => index * tabIndicatorWidth),
  });

  const upcoming = useMemo(
    () => matches.filter((m) => m.status === 'SCHEDULED' || m.status === 'LIVE'),
    [matches],
  );
  const finished = useMemo(
    () => matches.filter((m) => m.status === 'FINISHED'),
    [matches],
  );
  const shown = useMemo(
    () =>
      [...(tab === 'upcoming' ? upcoming : finished)].sort(
        (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
      ),
    [finished, tab, upcoming],
  );
  const matchGroups = useMemo(() => groupMatchesByDay(shown, locale), [locale, shown]);
  const groupStandings = useMemo(() => getGroupsFromMatches(matches), [matches]);

  const handleSave = async (matchId: string, score: [number, number], qualifier?: 'HOME' | 'AWAY' | null) => {
    try {
      const pred = await submitPrediction(matchId, score[0], score[1], qualifier);
      setPredictions((prev) => [...prev.filter((p) => p.matchId !== matchId), pred]);
    } catch {
      // silently fail
    }
  };

  const handleGroupOrder = async (groupId: string, orderedTeams: TeamInfo[]) => {
    setGroupPredictions((prev) => {
      const existing = prev.find((prediction) => prediction.group === groupId);
      const optimistic: GroupPrediction = existing
        ? { ...existing, orderedTeams, orderedTeamCodes: orderedTeams.map((team) => team.code) }
        : {
            _id: `local-${groupId}`,
            userId: '',
            group: groupId,
            orderedTeams,
            orderedTeamCodes: orderedTeams.map((team) => team.code),
            points: null,
          };

      return [...prev.filter((prediction) => prediction.group !== groupId), optimistic];
    });

    try {
      const saved = await submitGroupPrediction(groupId, orderedTeams);
      setGroupPredictions((prev) => [...prev.filter((prediction) => prediction.group !== groupId), saved]);
    } catch {
      await load();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LoadingView />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.fixedHeader}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('picks.title')}</Text>
          <Text style={styles.subtitle}>{t('picks.subtitle')}</Text>
        </View>

        <View
          style={styles.tabBar}
          onLayout={(event) => setTabBarWidth(event.nativeEvent.layout.width)}
        >
          {tabIndicatorWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.tabIndicator,
                {
                  width: tabIndicatorWidth,
                  transform: [{ translateX: tabIndicatorTranslate }],
                },
              ]}
            />
          )}

          {PICK_TABS.map((tabKey) => {
            const active = tab === tabKey;
            return (
              <TouchableOpacity
                key={tabKey}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setTab(tabKey)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {tabKey === 'upcoming' ? t('picks.upcoming') : tabKey === 'results' ? t('picks.results') : tabKey === 'groups' ? t('picks.groups') : t('picks.finals')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollTriggerProvider triggerRef={triggerRef}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        scrollEnabled={!isDraggingGroupTeam}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        onScroll={() => triggerRef.current()}
        scrollEventThrottle={200}
      >
        {tab === 'finals' ? (
          <TournamentPicksSection
            picks={tournamentPicks}
            onPickChange={handleTournamentPick}
          />
        ) : tab === 'groups' ? (
          <View style={styles.groupCards}>
            {groupStandings.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                order={groupPredMap[group.id]?.orderedTeams ?? group.teams}
                onOrderChange={handleGroupOrder}
                onDragStateChange={setIsDraggingGroupTeam}
              />
            ))}

            {groupStandings.length === 0 && !refreshing && (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>{t('picks.groupsPending')}</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.matchGroups}>
            {matchGroups.map((group) => (
              <View key={group.day} style={styles.dayGroup}>
                <Text style={styles.dayLabel}>{group.label}</Text>
                <View style={styles.matchList}>
                  {group.matches.map((m) => {
                    const pred = predMap[m._id];
                    const result = m.status === 'FINISHED' && pred ? getResult(pred, m) : null;
                    const canPredict = (m.status === 'SCHEDULED' || m.status === 'LIVE') && !hasTbdTeam(m);

                    return (
                      <MatchCard
                        key={m._id}
                        match={m}
                        prediction={pred}
                        result={result}
                        onPress={canPredict ? () => setSelectedMatch(m) : undefined}
                      />
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}

        {tab !== 'groups' && tab !== 'finals' && shown.length === 0 && !refreshing && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {tab === 'upcoming' ? t('picks.noUpcoming') : t('picks.noResults')}
            </Text>
          </View>
        )}
      </ScrollView>
      </ScrollTriggerProvider>

      <PredictionSheet
        match={selectedMatch}
        existing={
          selectedMatch && predMap[selectedMatch._id]
            ? {
                score: [predMap[selectedMatch._id].homeGoals, predMap[selectedMatch._id].awayGoals],
                qualifier: predMap[selectedMatch._id].qualifier,
              }
            : undefined
        }
        onSave={handleSave}
        onClose={() => setSelectedMatch(null)}
      />
    </SafeAreaView>
  );
}

function GroupCard({
  group,
  order,
  onOrderChange,
  onDragStateChange,
}: {
  group: GroupStanding;
  order: TeamInfo[];
  onOrderChange: (groupId: string, orderedTeams: TeamInfo[]) => void;
  onDragStateChange: (isDragging: boolean) => void;
}) {
  const { t } = useI18n();
  const moveTeam = (index: number, targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= order.length || targetIndex === index) return;
    const next = [...order];
    const [team] = next.splice(index, 1);
    next.splice(targetIndex, 0, team);
    onOrderChange(group.id, next);
  };

  return (
    <View style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupTitle}>{t('common.group', { group: group.id })}</Text>
      </View>

      {order.map((team, index) => {
        const qualifies = index < 2;
        const potentialQualifier = index === 2;

        return (
          <DraggableGroupTeamRow
            key={team.code}
            team={team}
            index={index}
            count={order.length}
            qualifies={qualifies}
            potentialQualifier={potentialQualifier}
            onMove={moveTeam}
            onDragStateChange={onDragStateChange}
          />
        );
      })}
    </View>
  );
}

const GROUP_ROW_HEIGHT = 52;

function DraggableGroupTeamRow({
  team,
  index,
  count,
  qualifies,
  potentialQualifier,
  onMove,
  onDragStateChange,
}: {
  team: TeamInfo;
  index: number;
  count: number;
  qualifies: boolean;
  potentialQualifier: boolean;
  onMove: (fromIndex: number, toIndex: number) => void;
  onDragStateChange: (isDragging: boolean) => void;
}) {
  const translateY = React.useRef(new Animated.Value(0)).current;
  const [isDragging, setIsDragging] = useState(false);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 2,
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
    [count, index, onDragStateChange, onMove, translateY],
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
      <View style={styles.dragHandle} {...panResponder.panHandlers}>
        <View style={styles.dragHandleLine} />
        <View style={styles.dragHandleLine} />
        <View style={styles.dragHandleLine} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  fixedHeader: {
    backgroundColor: colors.bg,
    gap: 16,
    padding: 18,
    paddingBottom: 14,
  },
  scroll: { padding: 18, paddingBottom: 16, paddingTop: 14, gap: 16 },

  titleRow: { marginTop: 4 },
  title: { color: colors.text, fontSize: 30, fontFamily: fonts.display },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 2, fontFamily: fonts.body },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    padding: 4,
    position: 'relative',
  },
  tabIndicator: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    bottom: 4,
    left: 4,
    position: 'absolute',
    top: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    zIndex: 1,
  },
  tabActive: {},
  tabText: { color: colors.muted, fontSize: 13, fontWeight: '600', fontFamily: fonts.bodyMedium },
  tabTextActive: { color: '#fff' },

  matchGroups: { gap: 18 },
  groupCards: { gap: 12 },
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
  dayGroup: { gap: 8 },
  dayLabel: {
    color: colors.dim,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: fonts.bodyMedium,
  },
  matchList: { gap: 10 },

  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { color: colors.muted, fontSize: 14 },
});

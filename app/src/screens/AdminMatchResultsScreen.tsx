import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Match, MatchWinner } from '../types';
import { fetchMatches } from '../api/matches';
import { setMatchResult } from '../api/admin';
import { colors, fonts } from '../theme';
import { useI18n } from '../i18n';

type Filter = 'played' | 'all';

function teamLabel(match: Match, side: 'home' | 'away'): string {
  const team = side === 'home' ? match.homeTeam : match.awayTeam;
  return team?.code || (side === 'home' ? match.homeTeamCode : match.awayTeamCode);
}

function dayLabel(value: string, locale: string): string {
  return new Date(value).toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
}

function timeLabel(value: string, locale: string): string {
  return new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export default function AdminMatchResultsScreen() {
  const navigation = useNavigation();
  const { t, locale } = useI18n();
  const [matches, setMatches] = useState<Match[]>([]);
  const [filter, setFilter] = useState<Filter>('played');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Match | null>(null);
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [winner, setWinner] = useState<MatchWinner | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMatches(await fetchMatches());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const now = Date.now();
  const visible = useMemo(() => {
    const list = [...matches].sort((a, b) => b.utcDate.localeCompare(a.utcDate));
    if (filter === 'played') return list.filter((m) => new Date(m.utcDate).getTime() <= now);
    return list;
  }, [matches, filter, now]);

  const grouped = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of visible) {
      const key = m.utcDate.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries());
  }, [visible]);

  const openMatch = (match: Match) => {
    setSelected(match);
    setHome(match.result ? String(match.result.homeGoals) : '');
    setAway(match.result ? String(match.result.awayGoals) : '');
    setWinner(match.result?.winner ?? null);
  };

  const isKnockout = selected ? selected.stage !== 'GROUP' : false;
  const homeNum = parseInt(home, 10);
  const awayNum = parseInt(away, 10);
  const validScore = Number.isInteger(homeNum) && Number.isInteger(awayNum) && homeNum >= 0 && awayNum >= 0;
  // For a knockout tie, a winner must be chosen explicitly (penalties).
  const needsWinner = isKnockout && validScore && homeNum === awayNum;
  const canSave = validScore && (!needsWinner || winner === 'HOME' || winner === 'AWAY');

  const save = async () => {
    if (!selected || !canSave) return;
    setSaving(true);
    try {
      const res = await setMatchResult(selected._id, {
        homeGoals: homeNum,
        awayGoals: awayNum,
        winner: needsWinner && winner ? winner : undefined,
      });
      setMatches((current) =>
        current.map((m) => (m._id === selected._id ? { ...m, status: 'FINISHED', result: res.match.result } : m)),
      );
      setSelected(null);
      Alert.alert(
        t('adminResults.savedTitle'),
        t('adminResults.savedBody', { count: res.scoring.predictionsScored }),
      );
    } catch (e) {
      Alert.alert(t('common.error'), t('adminResults.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.muted} />
          <Text style={styles.backText}>{t('profile.admin')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('adminResults.title')}</Text>
        <Text style={styles.subtitle}>{t('adminResults.subtitle')}</Text>
      </View>

      <View style={styles.filters}>
        {(['played', 'all'] as Filter[]).map((item) => (
          <TouchableOpacity
            key={item}
            activeOpacity={0.85}
            onPress={() => setFilter(item)}
            style={[styles.filterButton, filter === item && styles.filterButtonActive]}
          >
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>
              {t(`adminResults.filter.${item}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {grouped.map(([day, dayMatches]) => (
            <View key={day} style={styles.dayGroup}>
              <Text style={styles.dayLabel}>{dayLabel(day, locale)}</Text>
              {dayMatches.map((m) => (
                <TouchableOpacity key={m._id} activeOpacity={0.85} style={styles.row} onPress={() => openMatch(m)}>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTeams}>
                      {teamLabel(m, 'home')} v {teamLabel(m, 'away')}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {timeLabel(m.utcDate, locale)} · {m.stage.replace(/_/g, ' ')}
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    {m.result ? (
                      <Text style={styles.rowScore}>
                        {m.result.homeGoals} – {m.result.awayGoals}
                      </Text>
                    ) : (
                      <Text style={styles.rowPending}>{t('adminResults.noResult')}</Text>
                    )}
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          {grouped.length === 0 && <Text style={styles.empty}>{t('adminResults.empty')}</Text>}
        </ScrollView>
      )}

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {selected && (
              <>
                <Text style={styles.modalTitle}>
                  {teamLabel(selected, 'home')} v {teamLabel(selected, 'away')}
                </Text>
                <View style={styles.scoreRow}>
                  <View style={styles.scoreInputWrap}>
                    <Text style={styles.scoreInputLabel}>{teamLabel(selected, 'home')}</Text>
                    <TextInput
                      style={styles.scoreInput}
                      value={home}
                      onChangeText={setHome}
                      keyboardType="number-pad"
                      maxLength={2}
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                  <Text style={styles.scoreDash}>–</Text>
                  <View style={styles.scoreInputWrap}>
                    <Text style={styles.scoreInputLabel}>{teamLabel(selected, 'away')}</Text>
                    <TextInput
                      style={styles.scoreInput}
                      value={away}
                      onChangeText={setAway}
                      keyboardType="number-pad"
                      maxLength={2}
                      placeholder="0"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                </View>

                {needsWinner && (
                  <View style={styles.winnerSection}>
                    <Text style={styles.winnerLabel}>{t('adminResults.advances')}</Text>
                    <View style={styles.winnerRow}>
                      {(['HOME', 'AWAY'] as const).map((side) => (
                        <TouchableOpacity
                          key={side}
                          activeOpacity={0.85}
                          onPress={() => setWinner(side)}
                          style={[styles.winnerBtn, winner === side && styles.winnerBtnActive]}
                        >
                          <Text style={[styles.winnerBtnText, winner === side && styles.winnerBtnTextActive]}>
                            {teamLabel(selected, side === 'HOME' ? 'home' : 'away')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelected(null)} disabled={saving}>
                    <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
                    onPress={save}
                    disabled={!canSave || saving}
                  >
                    {saving ? (
                      <ActivityIndicator color={colors.bg} size="small" />
                    ) : (
                      <Text style={styles.saveText}>{t('adminResults.save')}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  backText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 14 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 24 },
  subtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  filterButton: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.card },
  filterButtonActive: { backgroundColor: colors.accent },
  filterText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 13 },
  filterTextActive: { color: colors.bg },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  dayGroup: { marginBottom: 18 },
  dayLabel: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 12, textTransform: 'uppercase', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  rowMain: { flex: 1 },
  rowTeams: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 15 },
  rowMeta: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowScore: { color: colors.text, fontFamily: fonts.display, fontSize: 16 },
  rowPending: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  empty: { color: colors.muted, fontFamily: fonts.body, textAlign: 'center', marginTop: 40 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', paddingHorizontal: 28 },
  modalCard: { backgroundColor: colors.card, borderRadius: 18, padding: 22 },
  modalTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 18, textAlign: 'center', marginBottom: 18 },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 14 },
  scoreInputWrap: { alignItems: 'center', gap: 6 },
  scoreInputLabel: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 13 },
  scoreInput: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.bg,
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 28,
    textAlign: 'center',
  },
  scoreDash: { color: colors.muted, fontFamily: fonts.display, fontSize: 24, marginBottom: 18 },
  winnerSection: { marginTop: 18 },
  winnerLabel: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 13, textAlign: 'center', marginBottom: 8 },
  winnerRow: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  winnerBtn: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 999, backgroundColor: colors.bg },
  winnerBtnActive: { backgroundColor: colors.accent },
  winnerBtnText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 14 },
  winnerBtnTextActive: { color: colors.bg },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.bg, alignItems: 'center' },
  cancelText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 15 },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveText: { color: colors.bg, fontFamily: fonts.display, fontSize: 15 },
});

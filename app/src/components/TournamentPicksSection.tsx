import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Flag from './ui/Flag';
import { colors, fonts } from '../theme';
import {
  PlayerOption,
  TeamOption,
  TournamentCatalogTeam,
  TournamentPicks,
  TOURNAMENT_SLOT_KEYS,
} from '../data/tournamentData';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../i18n';

interface TournamentPicksSectionProps {
  picks: TournamentPicks;
  teams: TournamentCatalogTeam[];
  onPickChange?: (key: keyof TournamentPicks, value: TeamOption | PlayerOption) => void;
}

const FINAL_FOUR_KEYS = ['champion', 'runnerUp', 'semi1', 'semi2'] as const;

type ActivePicker =
  | { type: 'team'; key: keyof TournamentPicks; title: string }
  | { type: 'player'; key: keyof TournamentPicks; title: string; players: PlayerOption[] };

const POS_COLOR: Record<string, string> = {
  FW: colors.accent,
  MF: colors.blue,
  DF: colors.warning,
  GK: colors.danger,
};
const POS_BG: Record<string, string> = {
  FW: 'rgba(0,168,126,0.15)',
  MF: 'rgba(73,79,223,0.15)',
  DF: 'rgba(236,126,0,0.15)',
  GK: 'rgba(226,59,74,0.15)',
};

function getTeamNameByCode(teams: TeamOption[], code: string, fallback: string) {
  return teams.find((option) => option.code === code)?.name ?? fallback;
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children.toUpperCase()}</Text>;
}

function CheckIcon() {
  return <Ionicons name="checkmark" size={15} color={colors.accent} />;
}

// ─── TEAM SLOT CARD ────────────────────────────────────────────
function SlotCard({
  pick,
  label,
  icon,
  onPress,
}: {
  pick?: TeamOption;
  label: string;
  icon: string;
  onPress?: () => void;
}) {
  const { t } = useI18n();
  return (
    <TouchableOpacity
      style={[styles.slotCard, !pick && styles.slotCardEmpty]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.slotIcon, pick ? styles.slotIconFilled : styles.slotIconEmpty]}>
        <Text style={styles.slotIconText}>{icon}</Text>
      </View>
      <View style={styles.slotContent}>
        <Text style={styles.slotLabel}>{label}</Text>
        {pick ? (
          <View style={styles.slotTeamRow}>
            <Flag code={pick.code} size={20} />
            <Text style={styles.slotTeamName}>{pick.name}</Text>
          </View>
        ) : (
          <Text style={styles.slotPlaceholder}>{t('tournament.tapToSelect')}</Text>
        )}
      </View>
      {pick && <CheckIcon />}
    </TouchableOpacity>
  );
}

// ─── AWARD CARD ────────────────────────────────────────────────
function AwardCard({
  pick,
  label,
  icon,
  accentColor = colors.blue,
  accentBg = colors.blueDim,
  teams,
  disabled,
  onPress,
}: {
  pick?: PlayerOption;
  label: string;
  icon: string;
  accentColor?: string;
  accentBg?: string;
  teams: TeamOption[];
  disabled?: boolean;
  onPress?: () => void;
}) {
  const { t } = useI18n();
  return (
    <TouchableOpacity
      style={[styles.slotCard, !pick && styles.awardCardEmpty, disabled && styles.slotCardDisabled]}
      onPress={onPress}
      disabled={!onPress || disabled}
      activeOpacity={0.75}
    >
      <View style={[styles.slotIcon, pick ? { backgroundColor: accentBg } : styles.slotIconEmpty]}>
        <Text style={styles.slotIconText}>{icon}</Text>
      </View>
      <View style={styles.slotContent}>
        <Text style={styles.slotLabel}>{label}</Text>
        {pick ? (
          <View>
            <Text style={styles.slotTeamName}>{pick.name}</Text>
            <View style={styles.playerMeta}>
              <Flag code={pick.code} size={14} />
              <Text style={styles.playerTeam}>{getTeamNameByCode(teams, pick.code, pick.team)}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.slotPlaceholder}>{t('tournament.tapToSelect')}</Text>
        )}
      </View>
      {pick && <CheckIcon />}
    </TouchableOpacity>
  );
}

// ─── TEAM PICKER MODAL ─────────────────────────────────────────
function TeamPickerModal({
  title,
  teams,
  selected,
  unavailableCodes,
  onSelect,
  onClose,
}: {
  title: string;
  teams: TournamentCatalogTeam[];
  selected?: TeamOption;
  unavailableCodes: Set<string>;
  onSelect: (team: TeamOption) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const slideAnim = useRef(new Animated.Value(600)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [search, setSearch] = useState('');

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, []);

  const close = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 600, duration: 260, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const pick = (team: TeamOption) => {
    onSelect(team);
    close();
  };

  const filtered = teams.filter((team) => team.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal transparent visible animationType="none" onRequestClose={close}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Text style={styles.sheetSubtitle}>{t('tournament.pickNationalTeam')}</Text>
        </View>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={14} color={colors.dim} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={t('tournament.searchTeam')}
            placeholderTextColor={colors.dim}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.dim} />
            </TouchableOpacity>
          )}
        </View>
        <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
          {filtered.map((team) => {
            const isSel = selected?.code === team.code;
            const unavailable = !isSel && unavailableCodes.has(team.code);
            return (
              <TouchableOpacity
                key={team.code}
                style={[styles.teamRow, isSel && styles.teamRowSelected, unavailable && styles.teamRowUnavailable]}
                onPress={() => pick(team)}
                disabled={unavailable}
                activeOpacity={0.7}
              >
                <Flag code={team.code} size={26} />
                <Text style={[
                  styles.teamRowName,
                  isSel && styles.teamRowNameSelected,
                  unavailable && styles.teamRowNameUnavailable,
                ]}>
                  {team.name}
                </Text>
                {isSel && <CheckIcon />}
                {unavailable && <Ionicons name="lock-closed" size={14} color={colors.dim} />}
              </TouchableOpacity>
            );
          })}
          <View style={styles.listBottomPad} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── PLAYER PICKER MODAL (two-step: country → player) ─────────
function PlayerPickerModal({
  title,
  players,
  selected,
  onSelect,
  onClose,
}: {
  title: string;
  players: PlayerOption[];
  selected?: PlayerOption;
  onSelect: (player: PlayerOption) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const slideAnim = useRef(new Animated.Value(600)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [step, setStep] = useState<'team' | 'player'>('team');
  const [selectedTeam, setSelectedTeam] = useState<{ name: string; code: string } | null>(null);
  const [search, setSearch] = useState('');

  // Unique teams from the player list, sorted alphabetically
  const teams = React.useMemo(() => {
    const seen = new Map<string, { name: string; code: string }>();
    players.forEach((p) => {
      if (!seen.has(p.code)) seen.set(p.code, { name: p.team, code: p.code });
    });
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [players]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    // Pre-select team if a player is already picked
    if (selected) {
      const match = teams.find((tm) => tm.code === selected.code);
      if (match) { setSelectedTeam(match); setStep('player'); }
    }
  }, []);

  const close = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 600, duration: 260, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const pick = (player: PlayerOption) => { onSelect(player); close(); };

  const goBack = () => { setStep('team'); setSearch(''); setSelectedTeam(null); };

  const selectTeam = (team: { name: string; code: string }) => {
    setSelectedTeam(team);
    setStep('player');
    setSearch('');
  };

  const filteredTeams = teams.filter((tm) =>
    tm.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredPlayers = selectedTeam
    ? players
        .filter((p) => p.code === selectedTeam.code)
        .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : [];

  return (
    <Modal transparent visible animationType="none" onRequestClose={close}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.sheetHandle} />

        {/* Header */}
        <View style={styles.playerSheetHeader}>
          {step === 'player' && (
            <TouchableOpacity onPress={goBack} style={styles.backButton} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
          <View style={styles.playerSheetHeaderText}>
            {step === 'team' ? (
              <Text style={styles.sheetTitle}>{title}</Text>
            ) : (
              <View style={styles.teamHeaderRow}>
                <Flag code={selectedTeam!.code} size={22} />
                <Text style={styles.sheetTitle}>{selectedTeam!.name}</Text>
              </View>
            )}
            <Text style={styles.sheetSubtitle}>
              {step === 'team' ? t('tournament.selectCountry') : t('tournament.searchPlayer')}
            </Text>
          </View>
          {/* Step dots */}
          <View style={styles.stepDots}>
            <View style={[styles.stepDot, step === 'team' && styles.stepDotActive]} />
            <View style={[styles.stepDot, step === 'player' && styles.stepDotActive]} />
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={14} color={colors.dim} />
          <TextInput
            key={step}
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={step === 'team' ? t('tournament.searchTeam') : t('tournament.searchPlayer')}
            placeholderTextColor={colors.dim}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.dim} />
            </TouchableOpacity>
          )}
        </View>

        {/* Step 1 — Teams */}
        {step === 'team' && (
          <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
            {filteredTeams.map((tm) => {
              const count = players.filter((p) => p.code === tm.code).length;
              return (
                <TouchableOpacity
                  key={tm.code}
                  style={styles.teamRow}
                  onPress={() => selectTeam(tm)}
                  activeOpacity={0.7}
                >
                  <Flag code={tm.code} size={26} />
                  <View style={styles.playerInfo}>
                    <Text style={styles.teamRowName}>{tm.name}</Text>
                    <Text style={styles.playerTeamSmall}>
                      {count} {count === 1 ? t('tournament.player') : t('tournament.players')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={colors.dim} />
                </TouchableOpacity>
              );
            })}
            <View style={styles.listBottomPad} />
          </ScrollView>
        )}

        {/* Step 2 — Players */}
        {step === 'player' && (
          <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
            {filteredPlayers.map((player, i) => {
              const isSel = selected?.name === player.name;
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.playerRow, isSel && styles.playerRowSelected]}
                  onPress={() => pick(player)}
                  activeOpacity={0.7}
                >
                  <View style={styles.playerInfo}>
                    <Text style={[styles.teamRowName, isSel && styles.teamRowNameSelected]}>
                      {player.name}
                    </Text>
                    <Text style={styles.playerTeamSmall}>{player.age}</Text>
                  </View>
                  <View style={[styles.posBadge, { backgroundColor: POS_BG[player.pos] }]}>
                    <Text style={[styles.posBadgeText, { color: POS_COLOR[player.pos] }]}>
                      {player.pos}
                    </Text>
                  </View>
                  {isSel && <CheckIcon />}
                </TouchableOpacity>
              );
            })}
            <View style={styles.listBottomPad} />
          </ScrollView>
        )}
      </Animated.View>
    </Modal>
  );
}

// ─── MAIN SECTION ──────────────────────────────────────────────
export default function TournamentPicksSection({
  picks,
  teams,
  onPickChange,
}: TournamentPicksSectionProps) {
  const { t } = useI18n();
  const [activePicker, setActivePicker] = useState<ActivePicker | null>(null);
  const allPlayers = React.useMemo(
    () => teams.flatMap((team) =>
      team.players.map((player) => ({
        ...player,
        team: team.name,
        code: team.code,
      }))
    ),
    [teams],
  );
  const bestYoungPlayers = React.useMemo(() => allPlayers.filter((player) => player.age <= 21), [allPlayers]);

  const doneCount = TOURNAMENT_SLOT_KEYS.filter((k) => picks[k] !== undefined).length;
  const totalCount = TOURNAMENT_SLOT_KEYS.length;

  const openTeam = (key: keyof TournamentPicks, title: string) =>
    onPickChange && setActivePicker({ type: 'team', key, title });

  const openPlayer = (key: keyof TournamentPicks, title: string, players: PlayerOption[]) =>
    onPickChange && setActivePicker({ type: 'player', key, title, players });

  const unavailableTeamCodes = React.useMemo(() => {
    const currentKey = activePicker?.type === 'team' ? activePicker.key : null;
    return new Set(
      FINAL_FOUR_KEYS
        .filter((key) => key !== currentKey)
        .map((key) => picks[key]?.code)
        .filter((code): code is string => !!code)
    );
  }, [activePicker, picks]);

  return (
    <View style={styles.container}>
      {/* Progress */}
      <View style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>{t('tournament.picks')}</Text>
          <Text style={styles.progressCount}>
            {doneCount}/{totalCount} {t('common.done')}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(doneCount / totalCount) * 100}%` as any }]} />
        </View>
      </View>

      {/* Final Four */}
      <View style={styles.section}>
        <SectionLabel>{t('tournament.finalFour')}</SectionLabel>
        <View style={styles.cards}>
          <SlotCard
            pick={picks.champion}
            label={t('tournament.winner')}
            icon="🏆"
            onPress={() => openTeam('champion', t('tournament.winner'))}
          />
          <SlotCard
            pick={picks.runnerUp}
            label={t('tournament.runnerUp')}
            icon="🥈"
            onPress={() => openTeam('runnerUp', t('tournament.runnerUp'))}
          />
          <View style={styles.semisRow}>
            <View style={styles.semiCell}>
              <SlotCard
                pick={picks.semi1}
                label={t('tournament.semiFinalist')}
                icon="⚽"
                onPress={() => openTeam('semi1', t('tournament.semiFinalist'))}
              />
            </View>
            <View style={styles.semiCell}>
              <SlotCard
                pick={picks.semi2}
                label={t('tournament.semiFinalist')}
                icon="⚽"
                onPress={() => openTeam('semi2', t('tournament.semiFinalist'))}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Individual Awards */}
      <View style={styles.section}>
        <SectionLabel>{t('tournament.individualAwards')}</SectionLabel>
        <View style={styles.cards}>
          <AwardCard
            pick={picks.bestPlayer as PlayerOption | undefined}
            label={t('tournament.bestPlayer')}
            icon="🌟"
            teams={teams}
            disabled={allPlayers.length === 0}
            onPress={() => openPlayer('bestPlayer', t('tournament.bestPlayer'), allPlayers)}
          />
          <AwardCard
            pick={picks.topScorer as PlayerOption | undefined}
            label={t('tournament.topScorer')}
            icon="👟"
            teams={teams}
            disabled={allPlayers.length === 0}
            onPress={() => openPlayer('topScorer', t('tournament.topScorer'), allPlayers)}
          />
          <AwardCard
            pick={picks.bestYoung as PlayerOption | undefined}
            label={t('tournament.bestYoung')}
            icon="🌱"
            accentColor={colors.warning}
            accentBg="rgba(236,126,0,0.14)"
            teams={teams}
            disabled={bestYoungPlayers.length === 0}
            onPress={() => openPlayer('bestYoung', t('tournament.bestYoung'), bestYoungPlayers)}
          />
        </View>
      </View>

      {/* Pickers */}
      {activePicker?.type === 'team' && (
        <TeamPickerModal
          title={activePicker.title}
          teams={teams}
          selected={picks[activePicker.key] as TeamOption | undefined}
          unavailableCodes={unavailableTeamCodes}
          onSelect={(team) => onPickChange?.(activePicker.key, team)}
          onClose={() => setActivePicker(null)}
        />
      )}
      {activePicker?.type === 'player' && (
        <PlayerPickerModal
          title={activePicker.title}
          players={activePicker.players}
          selected={picks[activePicker.key] as PlayerOption | undefined}
          onSelect={(player) => onPickChange?.(activePicker.key, player)}
          onClose={() => setActivePicker(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 20 },

  progressCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    paddingHorizontal: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  progressCount: { color: colors.accent, fontFamily: fonts.displayBold, fontSize: 13, fontWeight: '700' },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    // gradient approximated with a solid color; RN doesn't support CSS gradients natively
    backgroundColor: colors.accent,
    borderRadius: 2,
  },

  section: { gap: 0 },
  sectionLabel: {
    color: colors.dim,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  cards: { gap: 8 },

  slotCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  slotCardEmpty: {
    backgroundColor: 'rgba(0,168,126,0.04)',
    borderColor: 'rgba(0,168,126,0.22)',
  },
  awardCardEmpty: {
    backgroundColor: 'rgba(73,79,223,0.04)',
    borderColor: 'rgba(73,79,223,0.22)',
  },
  slotCardDisabled: { opacity: 0.5 },
  slotIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  slotIconFilled: { backgroundColor: colors.accentDim },
  slotIconEmpty: { backgroundColor: 'rgba(255,255,255,0.05)' },
  slotIconText: { fontSize: 17 },
  slotContent: { flex: 1, minWidth: 0 },
  slotLabel: {
    color: colors.dim,
    fontFamily: fonts.body,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  slotTeamRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  slotTeamName: {
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 14,
    fontWeight: '700',
  },
  slotPlaceholder: { color: colors.dim, fontFamily: fonts.bodyMedium, fontSize: 13 },

  playerMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  playerTeam: { color: colors.muted, fontFamily: fonts.body, fontSize: 11 },

  semisRow: { flexDirection: 'row', gap: 8 },
  semiCell: { flex: 1 },

  // Modal overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: colors.border,
    maxHeight: '82%',
    minHeight: '60%',
    flexDirection: 'column',
  },
  sheetHandle: {
    width: 34,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center',
    marginTop: 14,
  },
  sheetHeader: { padding: 14, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  playerSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 8,
  },
  playerSheetHeaderText: { flex: 1 },
  backButton: { padding: 4, marginRight: 2 },
  teamHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepDots: { flexDirection: 'row', gap: 5 },
  stepDot: {
    width: 20,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.dim,
  },
  stepDotActive: { backgroundColor: colors.accent },
  sheetTitle: {
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 17,
    fontWeight: '700',
  },
  sheetSubtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 13,
    padding: 0,
  },
  sheetList: { flex: 1, paddingHorizontal: 12 },
  listBottomPad: { height: 32 },

  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 11,
    paddingHorizontal: 10,
    borderRadius: 13,
    marginBottom: 3,
  },
  teamRowSelected: { backgroundColor: colors.accentDim },
  teamRowUnavailable: { opacity: 0.45 },
  teamRowName: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 14,
    fontWeight: '500',
  },
  teamRowNameSelected: { color: colors.accent, fontWeight: '700' },
  teamRowNameUnavailable: { color: colors.dim },

  playerInfo: { flex: 1, minWidth: 0 },
  playerTeamSmall: { color: colors.muted, fontFamily: fonts.body, fontSize: 10, marginTop: 1 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 4,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  playerRowSelected: {
    backgroundColor: colors.accentDim,
    borderColor: `${colors.accent}44`,
  },
  posBadge: {
    borderRadius: 9999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  posBadgeText: { fontFamily: fonts.bodyMedium, fontSize: 10, fontWeight: '600' },
});

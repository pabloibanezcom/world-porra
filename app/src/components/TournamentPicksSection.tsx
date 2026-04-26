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
  ALL_TEAMS,
  AWARD_PLAYERS,
  PlayerOption,
  TeamOption,
  TournamentPicks,
  TOURNAMENT_SLOT_KEYS,
} from '../data/tournamentData';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../i18n';

interface TournamentPicksSectionProps {
  picks: TournamentPicks;
  onPickChange: (key: keyof TournamentPicks, value: TeamOption | PlayerOption) => void;
}

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

function getTeamName(team: TeamOption, language: string) {
  return language === 'es' ? team.nameEs ?? team.name : team.name;
}

function getTeamNameByCode(code: string, fallback: string, language: string) {
  const team = ALL_TEAMS.find((option) => option.code === code);
  return team ? getTeamName(team, language) : fallback;
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
  onPress: () => void;
}) {
  const { language, t } = useI18n();
  return (
    <TouchableOpacity
      style={[styles.slotCard, !pick && styles.slotCardEmpty]}
      onPress={onPress}
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
            <Text style={styles.slotTeamName}>{getTeamName(pick, language)}</Text>
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
  onPress,
}: {
  pick?: PlayerOption;
  label: string;
  icon: string;
  accentColor?: string;
  accentBg?: string;
  onPress: () => void;
}) {
  const { language, t } = useI18n();
  return (
    <TouchableOpacity
      style={[styles.slotCard, !pick && styles.awardCardEmpty]}
      onPress={onPress}
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
              <Text style={styles.playerTeam}>{getTeamNameByCode(pick.code, pick.team, language)}</Text>
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
  selected,
  onSelect,
  onClose,
}: {
  title: string;
  selected?: TeamOption;
  onSelect: (team: TeamOption) => void;
  onClose: () => void;
}) {
  const { language, t } = useI18n();
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
    onSelect({ ...team, name: getTeamName(team, language) });
    close();
  };

  const filtered = ALL_TEAMS.filter((team) =>
    `${team.name} ${team.nameEs ?? ''}`.toLowerCase().includes(search.toLowerCase())
  );

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
            return (
              <TouchableOpacity
                key={team.code}
                style={[styles.teamRow, isSel && styles.teamRowSelected]}
                onPress={() => pick(team)}
                activeOpacity={0.7}
              >
                <Flag code={team.code} size={26} />
                <Text style={[styles.teamRowName, isSel && styles.teamRowNameSelected]}>
                  {getTeamName(team, language)}
                </Text>
                {isSel && <CheckIcon />}
              </TouchableOpacity>
            );
          })}
          <View style={styles.listBottomPad} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── PLAYER PICKER MODAL ───────────────────────────────────────
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
  const { language, t } = useI18n();
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

  const pick = (player: PlayerOption) => {
    onSelect(player);
    close();
  };

  const filtered = players.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      `${p.team} ${getTeamNameByCode(p.code, p.team, language)}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal transparent visible animationType="none" onRequestClose={close}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
        </View>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={14} color={colors.dim} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={t('tournament.searchPlayerTeam')}
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
          {filtered.map((player, i) => {
            const isSel = selected?.name === player.name;
            return (
              <TouchableOpacity
                key={i}
                style={[styles.teamRow, isSel && styles.teamRowSelected]}
                onPress={() => pick(player)}
                activeOpacity={0.7}
              >
                <Flag code={player.code} size={24} />
                <View style={styles.playerInfo}>
                  <Text style={[styles.teamRowName, isSel && styles.teamRowNameSelected]}>
                    {player.name}
                  </Text>
                  <Text style={styles.playerTeamSmall}>{getTeamNameByCode(player.code, player.team, language)}</Text>
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
      </Animated.View>
    </Modal>
  );
}

// ─── MAIN SECTION ──────────────────────────────────────────────
export default function TournamentPicksSection({
  picks,
  onPickChange,
}: TournamentPicksSectionProps) {
  const { t } = useI18n();
  const [activePicker, setActivePicker] = useState<ActivePicker | null>(null);

  const doneCount = TOURNAMENT_SLOT_KEYS.filter((k) => picks[k] !== undefined).length;
  const totalCount = TOURNAMENT_SLOT_KEYS.length;

  const openTeam = (key: keyof TournamentPicks, title: string) =>
    setActivePicker({ type: 'team', key, title });

  const openPlayer = (key: keyof TournamentPicks, title: string, players: PlayerOption[]) =>
    setActivePicker({ type: 'player', key, title, players });

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
            onPress={() => openPlayer('bestPlayer', t('tournament.bestPlayer'), AWARD_PLAYERS.bestPlayer)}
          />
          <AwardCard
            pick={picks.topScorer as PlayerOption | undefined}
            label={t('tournament.topScorer')}
            icon="👟"
            onPress={() => openPlayer('topScorer', t('tournament.topScorer'), AWARD_PLAYERS.topScorer)}
          />
          <AwardCard
            pick={picks.bestYoung as PlayerOption | undefined}
            label={t('tournament.bestYoung')}
            icon="🌱"
            accentColor={colors.warning}
            accentBg="rgba(236,126,0,0.14)"
            onPress={() => openPlayer('bestYoung', t('tournament.bestYoung'), AWARD_PLAYERS.bestYoung)}
          />
        </View>
      </View>

      {/* Pickers */}
      {activePicker?.type === 'team' && (
        <TeamPickerModal
          title={activePicker.title}
          selected={picks[activePicker.key] as TeamOption | undefined}
          onSelect={(team) => onPickChange(activePicker.key, team)}
          onClose={() => setActivePicker(null)}
        />
      )}
      {activePicker?.type === 'player' && (
        <PlayerPickerModal
          title={activePicker.title}
          players={activePicker.players}
          selected={picks[activePicker.key] as PlayerOption | undefined}
          onSelect={(player) => onPickChange(activePicker.key, player)}
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
  teamRowName: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 14,
    fontWeight: '500',
  },
  teamRowNameSelected: { color: colors.accent, fontWeight: '700' },

  playerInfo: { flex: 1, minWidth: 0 },
  playerTeamSmall: { color: colors.muted, fontFamily: fonts.body, fontSize: 10, marginTop: 1 },
  posBadge: {
    borderRadius: 9999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  posBadgeText: { fontFamily: fonts.bodyMedium, fontSize: 10, fontWeight: '600' },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { useI18n } from '../i18n';
import Flag from '../components/ui/Flag';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

// ── Shared sub-components ──────────────────────────────────────

function SummaryTile({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function TableRow({
  left,
  right,
  color = colors.text,
  highlight = false,
}: {
  left: string;
  right: string;
  color?: string;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.tableRow, highlight && styles.tableRowHighlight]}>
      <Text style={styles.tableRowLeft}>{left}</Text>
      <Text style={[styles.tableRowRight, { color }]}>{right}</Text>
    </View>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <View style={[styles.chevron, open && styles.chevronOpen]}>
      <Text style={styles.chevronText}>›</Text>
    </View>
  );
}

interface SectionCardProps {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  accentColor?: string;
  accentBg?: string;
  openId: string | null;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}

function SectionCard({
  id, icon, title, subtitle, accentColor = colors.accent, accentBg,
  openId, onToggle, children,
}: SectionCardProps) {
  const open = openId === id;
  return (
    <View style={[styles.sectionCard, open && { borderColor: accentColor + '44' }]}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => onToggle(id)}
        activeOpacity={0.7}
      >
        <View style={[styles.sectionIconBox, { backgroundColor: accentBg || colors.accentDim }]}>
          <Text style={styles.sectionIcon}>{icon}</Text>
        </View>
        <View style={styles.sectionTitleBlock}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
        <ChevronIcon open={open} />
      </TouchableOpacity>
      {open && (
        <View style={styles.sectionBody}>
          {children}
        </View>
      )}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────

export default function RulesScreen() {
  const { t } = useI18n();
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenId(prev => prev === id ? null : id);
  };

  const koRounds = [
    { key: 'r32',   label: t('rules.ko.r32'),   mult: 2, bonus: 6 },
    { key: 'r16',   label: t('rules.ko.r16'),   mult: 3, bonus: 8 },
    { key: 'qf',    label: t('rules.ko.qf'),    mult: 4, bonus: 10 },
    { key: '3rd',   label: t('rules.ko.3rd'),   mult: 4, bonus: 10 },
    { key: 'sf',    label: t('rules.ko.sf'),    mult: 5, bonus: 12 },
    { key: 'final', label: t('rules.ko.final'), mult: 6, bonus: 15 },
  ];

  const honorsRows = [
    { pred: t('rules.honors.predChamp'),   result: t('rules.honors.finishes1st'), pts: '40 pts', color: colors.accent },
    { pred: t('rules.honors.predChamp'),   result: t('rules.honors.finishes2nd'), pts: '15 pts', color: colors.muted },
    { pred: t('rules.honors.predRunner'),  result: t('rules.honors.finishes2nd'), pts: '25 pts', color: colors.accent },
    { pred: t('rules.honors.predRunner'),  result: t('rules.honors.finishes1st'), pts: '15 pts', color: colors.muted },
    { pred: t('rules.honors.predSemi'),    result: t('rules.honors.top4'),        pts: '15 pts', color: colors.accent },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('rules.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('rules.subtitle')}</Text>
        </View>

        {/* Quick Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryHeading}>{t('rules.quickSummary')}</Text>
          <View style={styles.summaryGrid}>
            <SummaryTile value="Odds×2"  label={t('rules.summary.outcome')}    color={colors.accent} />
            <SummaryTile value="+5 pts"  label={t('rules.summary.exactBonus')} color={colors.blue} />
            <SummaryTile value="×2 🃏"   label={t('rules.summary.jokers')}     color={colors.warning} />
          </View>
        </View>

        {/* ── 1. General Rules ── */}
        <SectionCard
          id="general" icon="📋"
          title={t('rules.general.title')}
          subtitle={t('rules.general.subtitle')}
          accentColor={colors.muted} accentBg="rgba(255,255,255,0.06)"
          openId={openId} onToggle={toggle}
        >
          <View style={styles.bulletList}>
            {([
              { icon: '🔒', title: t('rules.general.lock.title'),    body: t('rules.general.lock.body') },
              { icon: '🏅', title: t('rules.general.official.title'),body: t('rules.general.official.body') },
              { icon: '📅', title: t('rules.general.honors.title'),  body: t('rules.general.honors.body') },
              { icon: '🚫', title: t('rules.general.noPred.title'),  body: t('rules.general.noPred.body') },
            ] as const).map(item => (
              <View key={item.title} style={styles.bulletItem}>
                <Text style={styles.bulletIcon}>{item.icon}</Text>
                <View style={styles.bulletText}>
                  <Text style={styles.bulletTitle}>{item.title}</Text>
                  <Text style={styles.bulletBody}>{item.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </SectionCard>

        {/* ── 2. Group Stage ── */}
        <SectionCard
          id="group" icon="⚽"
          title={t('rules.group.title')}
          subtitle={t('rules.group.subtitle')}
          accentColor={colors.accent}
          openId={openId} onToggle={toggle}
        >
          <View style={styles.formulaCard}>
            <Text style={styles.formulaLabel}>{t('rules.group.formulaLabel')}</Text>
            <Text style={styles.formulaValue}>{t('rules.group.formulaValue')}</Text>
            <Text style={styles.formulaCap}>{t('rules.group.formulaCap')}</Text>
          </View>

          <Text style={styles.exampleLabel}>{t('rules.group.exampleLabel')}</Text>
          <View style={styles.exampleCard}>
            <View style={styles.exampleTeams}>
              <Flag code="FRA" size={18} />
              <Text style={styles.exampleTeamCode}>FRA</Text>
              <Text style={styles.exampleVs}>vs</Text>
              <Text style={styles.exampleTeamCode}>ARG</Text>
              <Flag code="ARG" size={18} />
            </View>
            <TableRow left={t('rules.group.ex.winOdds')}      right="2.10" />
            <TableRow left={t('rules.group.ex.outcomePts')}   right={t('rules.group.ex.outcomePtsVal')} color={colors.accent} />
            <TableRow left={t('rules.group.ex.exactHit')}     right={t('rules.group.ex.exactVal')}      color={colors.accent} />
            <TableRow left={t('rules.group.ex.total')}        right={t('rules.group.ex.totalVal')}       color={colors.accent} highlight />
          </View>
          <Text style={styles.tipText}>{t('rules.group.tip')}</Text>
        </SectionCard>

        {/* ── 3. Knockout Rounds ── */}
        <SectionCard
          id="knockout" icon="🏆"
          title={t('rules.ko.title')}
          subtitle={t('rules.ko.subtitle')}
          accentColor={colors.blue} accentBg={colors.blueDim}
          openId={openId} onToggle={toggle}
        >
          <Text style={styles.introText}>{t('rules.ko.intro')}</Text>

          <View style={styles.koTable}>
            <View style={styles.koTableHeader}>
              <Text style={[styles.koHeaderCell, { flex: 1 }]}>{t('rules.ko.colRound')}</Text>
              <Text style={[styles.koHeaderCell, styles.koHeaderMult]}>{t('rules.ko.colMult')}</Text>
              <Text style={[styles.koHeaderCell, styles.koHeaderBonus]}>{t('rules.ko.colBonus')}</Text>
            </View>
            {koRounds.map((r, i) => (
              <View key={r.key} style={[styles.koTableRow, i % 2 !== 0 && styles.koTableRowAlt]}>
                <Text style={[styles.koCell, { flex: 1 }]}>{r.label}</Text>
                <Text style={[styles.koCellBold, styles.koColMult, { color: colors.blue }]}>×{r.mult}</Text>
                <Text style={[styles.koCellBold, styles.koColBonus, { color: colors.accent }]}>+{r.bonus}</Text>
              </View>
            ))}
          </View>

          <View style={styles.infoBox}>
            <Text style={[styles.infoBoxText, { color: colors.blue }]}>{t('rules.ko.drawNote')}</Text>
          </View>
        </SectionCard>

        {/* ── 4. Jokers ── */}
        <SectionCard
          id="jokers" icon="🃏"
          title={t('rules.jokers.title')}
          subtitle={t('rules.jokers.subtitle')}
          accentColor={colors.warning} accentBg="rgba(236,126,0,0.14)"
          openId={openId} onToggle={toggle}
        >
          <View style={styles.jokerGrid}>
            {([
              { label: t('rules.jokers.group'),   sub: t('rules.jokers.groupSub') },
              { label: t('rules.jokers.knockout'), sub: t('rules.jokers.knockoutSub') },
            ] as const).map(j => (
              <View key={j.label} style={styles.jokerCard}>
                <Text style={styles.jokerEmoji}>🃏</Text>
                <Text style={styles.jokerLabel}>{j.label}</Text>
                <Text style={styles.jokerSub}>{j.sub}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.infoBox, { backgroundColor: 'rgba(236,126,0,0.08)', borderColor: 'rgba(236,126,0,0.22)' }]}>
            <Text style={[styles.jokerMultiplier, { color: colors.warning }]}>× 2</Text>
            <Text style={styles.infoBoxText}>{t('rules.jokers.body')}</Text>
          </View>
        </SectionCard>

        {/* ── 5. Group Standings ── */}
        <SectionCard
          id="standings" icon="📊"
          title={t('rules.standings.title')}
          subtitle={t('rules.standings.subtitle')}
          accentColor="#f5a623" accentBg="rgba(245,166,35,0.12)"
          openId={openId} onToggle={toggle}
        >
          <View style={styles.innerTable}>
            <TableRow left={t('rules.standings.1st')}         right="8 pts"   color={colors.accent} />
            <TableRow left={t('rules.standings.2nd')}         right="6 pts"   color={colors.accent} />
            <TableRow left={t('rules.standings.3rd')}         right="3 pts"   color={colors.muted} />
            <TableRow left={t('rules.standings.4th')}         right="3 pts"   color={colors.muted} />
            <TableRow left={t('rules.standings.perfect')}     right="+5 pts 🎯" color="#f5a623" highlight />
            <TableRow left={t('rules.standings.consolation')} right="2 pts"   color={colors.dim} />
          </View>
          <Text style={[styles.tipText, { marginTop: 10 }]}>{t('rules.standings.consolationNote')}</Text>
        </SectionCard>

        {/* ── 6. Honors Board ── */}
        <SectionCard
          id="honors" icon="🌟"
          title={t('rules.honors.title')}
          subtitle={t('rules.honors.subtitle')}
          openId={openId} onToggle={toggle}
        >
          <Text style={styles.innerSectionLabel}>{t('rules.honors.national')}</Text>
          <View style={styles.honorsTable}>
            {honorsRows.map((r, i) => (
              <View key={i} style={[styles.honorsRow, i > 0 && styles.honorsRowBorder]}>
                <Text style={styles.honorsCell}>{r.pred}</Text>
                <Text style={styles.honorsCellMuted}>{r.result}</Text>
                <Text style={[styles.honorsPoints, { color: r.color }]}>{r.pts}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.innerSectionLabel, { marginTop: 14 }]}>{t('rules.honors.individual')}</Text>
          <View style={styles.awardsList}>
            {([
              { icon: '👟', label: t('rules.honors.boot'),  pts: '30 pts', color: colors.accent },
              { icon: '🌟', label: t('rules.honors.ball'),  pts: '30 pts', color: colors.blue },
              { icon: '🌱', label: t('rules.honors.young'), pts: '20 pts', color: colors.warning },
            ] as const).map(a => (
              <View key={a.label} style={styles.awardRow}>
                <Text style={styles.awardIcon}>{a.icon}</Text>
                <Text style={styles.awardLabel}>{a.label}</Text>
                <Text style={[styles.awardPts, { color: a.color }]}>{a.pts}</Text>
              </View>
            ))}
          </View>
        </SectionCard>

        {/* ── 7. Tiebreaker ── */}
        <SectionCard
          id="tie" icon="⚖️"
          title={t('rules.tie.title')}
          subtitle={t('rules.tie.subtitle')}
          accentColor={colors.dim} accentBg="rgba(255,255,255,0.06)"
          openId={openId} onToggle={toggle}
        >
          <View style={styles.tieList}>
            {[
              t('rules.tie.step1'),
              t('rules.tie.step2'),
              t('rules.tie.step3'),
            ].map((label, i) => (
              <View key={i} style={styles.tieItem}>
                <View style={styles.tieNumber}>
                  <Text style={styles.tieNumberText}>{i + 1}</Text>
                </View>
                <Text style={styles.tieLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 40, gap: 16 },

  // Header
  header: { marginTop: 4, marginBottom: 4 },
  headerTitle: { color: colors.text, fontSize: 26, fontWeight: '700', fontFamily: fonts.display },
  headerSubtitle: { color: colors.muted, fontSize: 13, marginTop: 2, fontFamily: fonts.body },

  // Quick Summary
  summaryCard: {
    backgroundColor: 'rgba(0,168,126,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(0,168,126,0.2)',
    borderRadius: 18,
    padding: 16,
  },
  summaryHeading: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: fonts.bodyMedium,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  summaryGrid: { flexDirection: 'row', gap: 8 },
  summaryTile: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: fonts.display,
    lineHeight: 20,
  },
  summaryLabel: {
    color: colors.dim,
    fontSize: 9,
    marginTop: 3,
    textAlign: 'center',
    lineHeight: 13,
    fontFamily: fonts.body,
  },

  // Section card
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  sectionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sectionIcon: { fontSize: 20 },
  sectionTitleBlock: { flex: 1 },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.display,
  },
  sectionSubtitle: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
    fontFamily: fonts.body,
  },
  chevron: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  chevronText: { color: colors.dim, fontSize: 18, fontWeight: '300', lineHeight: 20 },
  sectionBody: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 18,
  },

  // Bullet list (General Rules)
  bulletList: { gap: 12, paddingTop: 14 },
  bulletItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bulletIcon: { fontSize: 18, flexShrink: 0, marginTop: 1 },
  bulletText: { flex: 1 },
  bulletTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: fonts.displayBold,
  },
  bulletBody: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 18,
    fontFamily: fonts.body,
  },

  // Formula (Group Stage)
  formulaCard: {
    backgroundColor: 'rgba(0,168,126,0.08)',
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,168,126,0.2)',
  },
  formulaLabel: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
    fontFamily: fonts.bodyMedium,
  },
  formulaValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.display,
  },
  formulaCap: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 4,
    fontFamily: fonts.body,
  },
  exampleLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    fontFamily: fonts.bodyMedium,
  },
  exampleCard: {
    backgroundColor: colors.card2,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exampleTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  exampleTeamCode: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.display,
  },
  exampleVs: { color: colors.dim, fontSize: 11, fontFamily: fonts.body },
  tipText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    fontFamily: fonts.body,
  },

  // Table rows
  innerTable: {
    backgroundColor: colors.card2,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowHighlight: { backgroundColor: 'rgba(245,166,35,0.06)' },
  tableRowLeft: {
    color: colors.muted,
    fontSize: 12,
    flex: 1,
    paddingRight: 8,
    lineHeight: 16,
    fontFamily: fonts.body,
  },
  tableRowRight: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.display,
    flexShrink: 0,
  },

  // Knockout table
  introText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 12,
    marginTop: 12,
    fontFamily: fonts.body,
  },
  koTable: {
    backgroundColor: colors.card2,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  koTableHeader: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  koHeaderCell: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.dim,
    fontFamily: fonts.bodyMedium,
  },
  koHeaderMult: { textAlign: 'center', width: 50, color: colors.blue },
  koHeaderBonus: { textAlign: 'center', width: 50, color: colors.accent },
  koTableRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  koTableRowAlt: { backgroundColor: 'rgba(255,255,255,0.015)' },
  koCell: { color: colors.text, fontSize: 12, fontFamily: fonts.body },
  koCellBold: { fontSize: 13, fontWeight: '700', fontFamily: fonts.display },
  koColMult: { textAlign: 'center', width: 50 },
  koColBonus: { textAlign: 'center', width: 50 },

  // Info box
  infoBox: {
    backgroundColor: 'rgba(73,79,223,0.08)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(73,79,223,0.2)',
  },
  infoBoxText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 17,
    fontFamily: fonts.body,
  },

  // Jokers
  jokerGrid: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 12 },
  jokerCard: {
    flex: 1,
    backgroundColor: colors.card2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    alignItems: 'center',
  },
  jokerEmoji: { fontSize: 24, marginBottom: 6 },
  jokerLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.display,
    textAlign: 'center',
  },
  jokerSub: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 3,
    fontFamily: fonts.body,
    textAlign: 'center',
  },
  jokerMultiplier: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: fonts.display,
    textAlign: 'center',
    marginBottom: 4,
  },

  // Honors Board
  innerSectionLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
    fontFamily: fonts.bodyMedium,
  },
  honorsTable: {
    backgroundColor: colors.card2,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  honorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 6,
  },
  honorsRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  honorsCell: {
    flex: 1,
    color: colors.text,
    fontSize: 11,
    fontFamily: fonts.body,
  },
  honorsCellMuted: {
    flex: 1,
    color: colors.muted,
    fontSize: 11,
    fontFamily: fonts.body,
  },
  honorsPoints: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.display,
    flexShrink: 0,
  },
  awardsList: { gap: 8 },
  awardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 11,
  },
  awardIcon: { fontSize: 20, flexShrink: 0 },
  awardLabel: { flex: 1, color: colors.text, fontSize: 12, fontFamily: fonts.body },
  awardPts: { fontSize: 15, fontWeight: '800', fontFamily: fonts.display },

  // Tiebreaker
  tieList: { gap: 10, paddingTop: 12 },
  tieItem: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  tieNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tieNumberText: {
    color: colors.dim,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: fonts.display,
  },
  tieLabel: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
    fontFamily: fonts.body,
  },
});

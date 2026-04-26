import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/authStore';
import { fetchMyLeagues } from '../api/leagues';
import { fetchMyPredictions } from '../api/predictions';
import { League, Prediction } from '../types';
import Avatar from '../components/ui/Avatar';
import { colors, fonts } from '../theme';
import { sortMembersByPoints } from '../utils/league';
import { usePushNotifications } from '../hooks/usePushNotifications';
import NotifyModal from '../components/NotifyModal';
import { apiClient } from '../api/client';
import { Language, useI18n } from '../i18n';

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children.toUpperCase()}</Text>;
}

function Tag({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      <Text style={[styles.tagText, { color }]}>{children}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { language, setLanguage, t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const [league, setLeague] = useState<League | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const { isSubscribed, loading: pushLoading, subscribe, unsubscribe, isSupported: pushSupported } = usePushNotifications();
  const [notifyModalVisible, setNotifyModalVisible] = useState(false);

  useEffect(() => {
    Promise.all([fetchMyLeagues(), fetchMyPredictions()])
      .then(([leagues, preds]) => {
        if (leagues.length > 0) setLeague(leagues[0]);
        setPredictions(preds);
      })
      .catch(() => {});
  }, []);

  const totalPoints = predictions.reduce((a, p) => a + (p.points ?? 0), 0);
  const exactCount = predictions.filter((p) => p.points !== null && p.points >= 10).length;

  const myRank = league
    ? (() => {
        const sorted = sortMembersByPoints(league.members);
        const idx = sorted.findIndex(
          (m) => (m.userId as any)?.id === user?.id || (m.userId as any)?._id === user?.id
        );
        return idx >= 0 ? idx + 1 : '—';
      })()
    : '—';

  const accountItems = [
    { label: t('profile.editProfile'), value: '' },
    { label: t('profile.signOut'), value: '', danger: true, onPress: signOut },
  ];

  const handleBroadcast = async (title: string, body: string) => {
    await apiClient.post('/notifications/broadcast', { title, body });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatarImg} />
          ) : (
            <Avatar name={user?.name ?? '?'} color="#494fdf" size={76} />
          )}
          <View style={styles.nameBlock}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
          <View style={styles.tags}>
            <Tag color={colors.accent} bg={colors.accentDim}>{t('profile.rankTag', { rank: myRank })}</Tag>
            <Tag color={colors.blue} bg={colors.blueDim}>{totalPoints} {t('common.points')}</Tag>
            <Tag color={colors.muted} bg="rgba(255,255,255,0.06)">{t('profile.matches', { count: predictions.length })}</Tag>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: t('common.rank'), value: `#${myRank}`, color: colors.accent },
            { label: t('common.points'), value: `${totalPoints}`, color: colors.text },
            { label: t('profile.exactScores'), value: `${exactCount}`, color: colors.blue },
          ].map(({ label, value, color }) => (
            <View key={label} style={styles.statCard}>
              <Text style={[styles.statValue, { color }]}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Notifications */}
        <View>
          <SectionLabel>{t('profile.notifications')}</SectionLabel>
          <View style={styles.card}>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>{t('profile.pushNotifications')}</Text>
              {pushSupported ? (
                <Switch
                  value={isSubscribed}
                  onValueChange={isSubscribed ? unsubscribe : subscribe}
                  disabled={pushLoading}
                  trackColor={{ true: colors.accent, false: colors.border }}
                  thumbColor={colors.text}
                />
              ) : (
                <Text style={styles.settingsValue}>{t('common.notAvailable')}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Master: broadcast to all */}
        {user?.isMaster && (
          <View>
            <SectionLabel>{t('profile.admin')}</SectionLabel>
            <View style={styles.card}>
              <TouchableOpacity style={styles.settingsRow} onPress={() => setNotifyModalVisible(true)}>
                <Text style={styles.settingsLabel}>{t('profile.notifyAll')}</Text>
                <View style={styles.settingsRight}>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View>
          <SectionLabel>{t('common.language')}</SectionLabel>
          <View style={styles.languageCard}>
            <View style={styles.languageSummary}>
              <Text style={styles.languageFlag}>{language === 'en' ? '🇬🇧' : '🇪🇸'}</Text>
              <Text style={styles.languageCurrent}>{t(`language.${language}`)}</Text>
            </View>
            <View style={styles.languageToggle}>
              {(['en', 'es'] as Language[]).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.languageOption,
                    option === language && styles.languageOptionActive,
                  ]}
                  onPress={() => setLanguage(option)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.languageOptionText,
                      option === language && styles.languageOptionTextActive,
                    ]}
                  >
                    {option.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Account */}
        <View>
          <SectionLabel>{t('profile.account')}</SectionLabel>
          <View style={styles.card}>
            {accountItems.map((item, i) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.settingsRow, i < accountItems.length - 1 && styles.settingsRowBorder]}
                onPress={item.onPress}
                disabled={!item.onPress}
              >
                <Text style={[styles.settingsLabel, item.danger && { color: colors.danger }]}>
                  {item.label}
                </Text>
                <View style={styles.settingsRight}>
                  {!!item.value && <Text style={styles.settingsValue}>{item.value}</Text>}
                  <Text style={styles.chevron}>›</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <NotifyModal
        visible={notifyModalVisible}
        title={t('profile.notifyAll')}
        onClose={() => setNotifyModalVisible(false)}
        onSend={handleBroadcast}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 18, paddingBottom: 16, gap: 18 },

  avatarSection: { alignItems: 'center', gap: 12, paddingTop: 14 },
  avatarImg: { width: 76, height: 76, borderRadius: 38 },
  nameBlock: { alignItems: 'center' },
  name: { color: colors.text, fontSize: 26, fontFamily: fonts.display },
  email: { color: colors.muted, fontSize: 12, marginTop: 2, fontFamily: fonts.body },
  tags: { flexDirection: 'row', gap: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  tagText: { fontSize: 10, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
    padding: 14, alignItems: 'center',
  },
  statValue: { fontSize: 20, fontWeight: '700', fontFamily: fonts.bodyMedium },
  statLabel: {
    color: colors.dim,
    fontSize: 10,
    lineHeight: 12,
    marginTop: 2,
    minHeight: 24,
    textAlign: 'center',
    fontFamily: fonts.body,
  },

  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: colors.dim, letterSpacing: 1.2, marginBottom: 8, fontFamily: fonts.bodyMedium,
  },

  card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  languageCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  languageSummary: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  languageFlag: { fontSize: 20 },
  languageCurrent: { color: colors.text, fontSize: 14, fontFamily: fonts.body },
  languageToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    padding: 3,
    gap: 3,
  },
  languageOption: {
    minWidth: 44,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  languageOptionActive: { backgroundColor: colors.accent },
  languageOptionText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: fonts.display,
  },
  languageOptionTextActive: { color: colors.text },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, paddingHorizontal: 16,
  },
  settingsRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  settingsLabel: { color: colors.text, fontSize: 14, fontFamily: fonts.body },
  settingsRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  settingsValue: { color: colors.muted, fontSize: 13 },
  chevron: { color: colors.dim, fontSize: 18 },
});

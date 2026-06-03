import React, { useEffect, useState } from 'react';
import {
  Alert,
  Share,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Image,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { fetchMyLeagues } from '../api/leagues';
import { fetchMyPredictions } from '../api/predictions';
import { League, Prediction } from '../types';
import Avatar from '../components/ui/Avatar';
import { colors, fonts } from '../theme';
import { sortMembersByPoints } from '../utils/league';
import { usePushNotifications } from '../hooks/usePushNotifications';
import NotifyModal from '../components/NotifyModal';
import { apiClient, getApiBaseUrl } from '../api/client';
import { generateLeagueCreationInvite } from '../api/leagueCreationInvites';
import { buildLeagueCreationInviteUrl } from '../utils/inviteLinks';
import { ApiHealth, fetchApiHealth } from '../api/config';
import { getActiveApiScenario } from '../api/scenario';
import { Language, useI18n } from '../i18n';
import ApiScenarioSelector from '../components/ApiScenarioSelector';

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
  const navigation = useNavigation();
  const { language, setLanguage, t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const updateProfileName = useAuthStore((s) => s.updateProfileName);
  const [league, setLeague] = useState<League | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const { isSubscribed, loading: pushLoading, subscribe, unsubscribe, isSupported: pushSupported } = usePushNotifications();
  const [notifyModalVisible, setNotifyModalVisible] = useState(false);
  const [editNameVisible, setEditNameVisible] = useState(false);
  const [displayName, setDisplayName] = useState(user?.name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [apiHealth, setApiHealth] = useState<ApiHealth | null>(null);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const showDiagnostics = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_SCENARIO_SWITCHER === 'true';

  useEffect(() => {
    Promise.all([fetchMyLeagues(), fetchMyPredictions()])
      .then(([leagues, preds]) => {
        if (leagues.length > 0) setLeague(leagues[0]);
        setPredictions(preds);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!showDiagnostics) return;

    getActiveApiScenario().then(setActiveScenario).catch(() => {});
    fetchApiHealth().then(setApiHealth).catch(() => {});
  }, [showDiagnostics]);

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
    { label: t('profile.editProfile'), value: '', onPress: () => {
      setDisplayName(user?.name ?? '');
      setNameError(null);
      setEditNameVisible(true);
    } },
    { label: t('profile.signOut'), value: '', danger: true, onPress: signOut },
  ];

  const handleBroadcast = async (title: string, body: string) => {
    await apiClient.post('/notifications/broadcast', { title, body });
  };

  const handleInviteToCreateLeague = async () => {
    try {
      const { token } = await generateLeagueCreationInvite();
      const url = buildLeagueCreationInviteUrl(token);
      await Share.share({ message: t('profile.inviteToCreateLeagueShareMessage', { url }) });
    } catch {
      Alert.alert(t('common.error'), t('profile.inviteToCreateLeagueFailed'));
    }
  };

  const handleSaveName = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      setNameError(t('profile.nameRequired'));
      return;
    }
    if (trimmed.length > 40) {
      setNameError(t('profile.nameTooLong'));
      return;
    }

    setSavingName(true);
    setNameError(null);
    try {
      await updateProfileName(trimmed);
      setEditNameVisible(false);
    } catch {
      setNameError(t('profile.nameUpdateFailed'));
    } finally {
      setSavingName(false);
    }
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

        {showDiagnostics && (
          <View>
            <SectionLabel>{t('scenario.label')}</SectionLabel>
            <ApiScenarioSelector />
          </View>
        )}

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

        {/* Master: admin tools */}
        {user?.isMaster && (
          <View>
            <SectionLabel>{t('profile.admin')}</SectionLabel>
            <View style={styles.card}>
              <TouchableOpacity
                style={[styles.settingsRow, styles.settingsRowBorder]}
                onPress={() => (navigation as any).navigate('AdminUsers')}
              >
                <Text style={styles.settingsLabel}>{t('profile.manageUsers')}</Text>
                <View style={styles.settingsRight}>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.settingsRow, styles.settingsRowBorder]}
                onPress={() => (navigation as any).navigate('AdminContactMessages')}
              >
                <Text style={styles.settingsLabel}>{t('profile.contactMessages')}</Text>
                <View style={styles.settingsRight}>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.settingsRow, styles.settingsRowBorder]}
                onPress={() => setNotifyModalVisible(true)}
              >
                <Text style={styles.settingsLabel}>{t('profile.notifyAll')}</Text>
                <View style={styles.settingsRight}>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.settingsRow} onPress={handleInviteToCreateLeague}>
                <Text style={styles.settingsLabel}>{t('profile.inviteToCreateLeague')}</Text>
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

        {showDiagnostics && (
          <View>
            <SectionLabel>{t('profile.diagnostics')}</SectionLabel>
            <View style={styles.card}>
              <DiagnosticsRow label={t('profile.apiUrl')} value={getApiBaseUrl()} />
              <DiagnosticsRow label={t('profile.apiScenario')} value={activeScenario || apiHealth?.scenario || 'default'} />
              <DiagnosticsRow label={t('profile.apiStatus')} value={apiHealth ? `${apiHealth.status} · ${apiHealth.db}` : t('common.notAvailable')} />
              <DiagnosticsRow label={t('profile.apiCommit')} value={apiHealth?.deployment?.commitSha?.slice(0, 7) || t('common.notAvailable')} />
            </View>
          </View>
        )}

        {/* Account */}
        <View>
          <SectionLabel>{t('profile.account')}</SectionLabel>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.settingsRowBorder}
              onPress={() => (navigation as any).navigate('ContactMaster')}
            >
              <View style={styles.settingsRow}>
                <Text style={styles.settingsLabel}>{t('profile.contactMaster')}</Text>
                <View style={styles.settingsRight}>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </View>
            </TouchableOpacity>
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

      <Modal
        visible={editNameVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditNameVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('profile.displayName')}</Text>
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={40}
              placeholder={t('profile.displayNamePlaceholder')}
              placeholderTextColor={colors.dim}
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
            />
            {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditNameVisible(false)}
                disabled={savingName}
              >
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, savingName && styles.disabledButton]}
                onPress={handleSaveName}
                disabled={savingName}
              >
                <Text style={styles.saveButtonText}>{t('profile.saveName')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DiagnosticsRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.diagnosticsRow}>
      <Text style={styles.diagnosticsLabel}>{label}</Text>
      <Text style={styles.diagnosticsValue} numberOfLines={1}>{value}</Text>
    </View>
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

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 12,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontFamily: fonts.displayBold,
    fontWeight: '700',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.body,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontFamily: fonts.body,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  modalButton: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  saveButton: {
    backgroundColor: colors.accent,
  },
  disabledButton: {
    opacity: 0.7,
  },
  cancelButtonText: {
    color: colors.text,
    fontFamily: fonts.bodyMedium,
    fontWeight: '700',
  },
  saveButtonText: {
    color: '#fff',
    fontFamily: fonts.bodyMedium,
    fontWeight: '700',
  },

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
  diagnosticsRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  diagnosticsLabel: {
    color: colors.dim,
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  diagnosticsValue: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  chevron: { color: colors.dim, fontSize: 18 },
});

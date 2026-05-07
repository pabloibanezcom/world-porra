import React, { useEffect, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_SCENARIOS, ApiScenarioSlug, getActiveApiScenario, getScenarioLabel, setActiveApiScenario } from '../api/scenario';
import { setApiScenarioBaseUrl } from '../api/client';
import { useAuthStore } from '../store/authStore';
import { colors, fonts } from '../theme';
import { useI18n } from '../i18n';

export default function ApiScenarioSelector() {
  const { t } = useI18n();
  const signOut = useAuthStore((state) => state.signOut);
  const [activeScenario, setActiveScenario] = useState<ApiScenarioSlug>('');
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    getActiveApiScenario()
      .then(async (scenario) => {
        setActiveScenario(scenario);
        await setActiveApiScenario(scenario);
      })
      .catch(() => {});
  }, []);

  const handleSelect = async (scenario: ApiScenarioSlug) => {
    setModalVisible(false);
    if (scenario === activeScenario) return;

    await setActiveApiScenario(scenario);
    setApiScenarioBaseUrl(scenario);
    await signOut();
    setActiveScenario(scenario);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (scenario) url.searchParams.set('scenario', scenario);
      else url.searchParams.delete('scenario');
      window.location.href = url.toString();
    }
  };

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={() => setModalVisible(true)} activeOpacity={0.85}>
        <View>
          <Text style={styles.label}>{t('scenario.label')}</Text>
          <Text style={styles.value}>{getScenarioLabel(activeScenario)}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('scenario.select')}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.close}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>{t('scenario.switchHint')}</Text>
            <View style={styles.options}>
              {API_SCENARIOS.map((scenario) => {
                const selected = scenario.slug === activeScenario;
                return (
                  <TouchableOpacity
                    key={scenario.slug || 'base'}
                    style={[styles.option, selected && styles.optionSelected]}
                    onPress={() => handleSelect(scenario.slug)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{scenario.label}</Text>
                    {selected ? <Text style={styles.check}>✓</Text> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { color: colors.dim, fontSize: 11, fontFamily: fonts.bodyMedium, textTransform: 'uppercase', letterSpacing: 1 },
  value: { color: colors.text, fontSize: 14, fontFamily: fonts.body, marginTop: 3 },
  chevron: { color: colors.dim, fontSize: 20 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 20 },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  modalTitle: { color: colors.text, fontSize: 20, fontFamily: fonts.displayBold, fontWeight: '700' },
  close: { color: colors.accent, fontSize: 14, fontFamily: fonts.bodyMedium, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18, fontFamily: fonts.body },
  options: { gap: 8 },
  option: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionSelected: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  optionText: { color: colors.text, fontSize: 14, fontFamily: fonts.body },
  optionTextSelected: { color: colors.accent, fontFamily: fonts.bodyMedium, fontWeight: '700' },
  check: { color: colors.accent, fontSize: 16, fontWeight: '800' },
});

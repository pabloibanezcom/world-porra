import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createLeague } from '../api/leagues';
import { colors, spacing, fontSize, borderRadius } from '../theme';
import { useI18n } from '../i18n';

export default function CreateLeagueScreen() {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<any>();

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('createLeague.required'));
      return;
    }

    setLoading(true);
    try {
      const league = await createLeague(name.trim());
      Alert.alert(t('createLeague.successTitle'), t('createLeague.inviteCode', { code: league.inviteCode }), [
        {
          text: t('common.ok'),
          onPress: () =>
            navigation.navigate('Main', {
              screen: 'Leagues',
              params: {
                screen: 'LeagueDetail',
                params: { leagueId: league._id },
              },
            }),
        },
      ]);
    } catch {
      Alert.alert(t('common.error'), t('createLeague.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('createLeague.name')}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={t('createLeague.placeholder')}
        maxLength={50}
        autoFocus
      />
      <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('createLeague.submit')}</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    marginBottom: spacing.lg,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: fontSize.md, fontWeight: '600' },
});

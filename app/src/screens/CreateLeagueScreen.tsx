import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { StackActions, useNavigation } from '@react-navigation/native';
import { createLeague } from '../api/leagues';
import { colors, fonts } from '../theme';
import { useI18n } from '../i18n';

export default function CreateLeagueScreen() {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [entryFee, setEntryFee] = useState('');
  const [firstPrize, setFirstPrize] = useState('');
  const [secondPrize, setSecondPrize] = useState('');
  const [thirdPrize, setThirdPrize] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<any>();
  const trimmedName = name.trim();
  const parsedEntryFee = Number(entryFee || 0);
  const parsedPrizes = [Number(firstPrize || 0), Number(secondPrize || 0), Number(thirdPrize || 0)];

  const close = () => {
    if (!loading) navigation.goBack();
  };

  const handleCreate = async () => {
    if (!trimmedName) {
      Alert.alert(t('common.error'), t('createLeague.required'));
      return;
    }
    if (
      Number.isNaN(parsedEntryFee) ||
      parsedEntryFee < 0 ||
      parsedPrizes.some((value) => Number.isNaN(value) || value < 0) ||
      parsedPrizes.reduce((sum, value) => sum + value, 0) > parsedEntryFee
    ) {
      Alert.alert(t('common.error'), t('payments.invalidSettings'));
      return;
    }

    setLoading(true);
    try {
      const league = await createLeague(trimmedName, {
        entryFee: parsedEntryFee,
        payoutSplits: [
          { position: 1, amount: parsedPrizes[0] },
          { position: 2, amount: parsedPrizes[1] },
          { position: 3, amount: parsedPrizes[2] },
        ],
      });
      navigation.dispatch(
        StackActions.replace('Main', {
          screen: 'Leagues',
          params: {
            screen: 'LeagueDetail',
            params: { leagueId: league._id },
          },
        })
      );
    } catch (err: any) {
      Alert.alert(t('common.error'), err.response?.data?.error || t('createLeague.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={styles.sheet}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('nav.createLeague')}</Text>
          <Text style={styles.label}>{t('createLeague.name')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('createLeague.placeholder')}
            placeholderTextColor={colors.dim}
            maxLength={50}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
          <Text style={styles.label}>{t('payments.entryFee')}</Text>
          <TextInput
            style={styles.input}
            value={entryFee}
            onChangeText={setEntryFee}
            placeholder="0 EUR"
            placeholderTextColor={colors.dim}
            keyboardType="decimal-pad"
            returnKeyType="next"
          />
          <Text style={styles.label}>{t('payments.payoutSplit')}</Text>
          <View style={styles.splitRow}>
            <SplitInput label="1st" value={firstPrize} onChangeText={setFirstPrize} />
            <SplitInput label="2nd" value={secondPrize} onChangeText={setSecondPrize} />
            <SplitInput label="3rd" value={thirdPrize} onChangeText={setThirdPrize} />
          </View>
          <TouchableOpacity
            style={[styles.button, !trimmedName && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={loading || !trimmedName}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t('createLeague.submit')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function SplitInput({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.splitInputWrap}>
      <Text style={styles.splitLabel}>{label}</Text>
      <TextInput
        style={[styles.input, styles.splitInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder="0"
        placeholderTextColor={colors.dim}
        keyboardType="decimal-pad"
        returnKeyType="next"
      />
      <Text style={styles.euroSign}>€</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 24,
    paddingBottom: 44,
    maxHeight: '92%',
  },
  handle: {
    width: 34,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 18,
  },
  label: {
    color: colors.dim,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.card2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 16,
  },
  splitRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  splitInputWrap: { flex: 1 },
  splitLabel: {
    color: colors.dim,
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 6,
  },
  splitInput: { marginBottom: 0, paddingRight: 26 },
  euroSign: { position: 'absolute', right: 10, bottom: 13, color: colors.muted, fontSize: 14 },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#fff',
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    fontWeight: '700',
  },
});

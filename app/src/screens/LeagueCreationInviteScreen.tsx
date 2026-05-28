import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StackActions, useNavigation, useRoute } from '@react-navigation/native';
import { redeemLeagueCreationInvite } from '../api/leagueCreationInvites';
import { usePendingLeagueCreationInviteStore } from '../store/pendingLeagueCreationInviteStore';
import { useAuthStore } from '../store/authStore';
import { colors, fonts } from '../theme';
import { useI18n } from '../i18n';

export default function LeagueCreationInviteScreen() {
  const { t } = useI18n();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [loading, setLoading] = useState(false);
  const clearPendingToken = usePendingLeagueCreationInviteStore((s) => s.clearPendingToken);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const token: string | undefined = route.params?.token;

  useEffect(() => {
    if (!token) {
      navigation.goBack();
    }
  }, [token, navigation]);

  const close = () => {
    if (!loading) navigation.goBack();
  };

  const handleAccept = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await redeemLeagueCreationInvite(token);
      await clearPendingToken();
      await refreshUser();
      navigation.dispatch(
        StackActions.replace('CreateLeague')
      );
    } catch (err: any) {
      const message = err.response?.data?.error || t('leagueCreationInvite.failed');
      Alert.alert(t('common.error'), message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) return null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.emoji}>🏆</Text>
        <Text style={styles.title}>{t('leagueCreationInvite.title')}</Text>
        <Text style={styles.body}>{t('leagueCreationInvite.body')}</Text>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleAccept}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{t('leagueCreationInvite.accept')}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={close} disabled={loading}>
          <Text style={styles.cancelText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    alignItems: 'center',
  },
  handle: {
    width: 34,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center',
    marginBottom: 24,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  button: {
    width: '100%',
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 10,
  },
  cancelText: {
    color: colors.dim,
    fontFamily: fonts.body,
    fontSize: 14,
  },
});

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { createContactMessage } from '../api/contactMessages';
import { colors, fonts } from '../theme';
import { useI18n } from '../i18n';

export default function ContactMasterScreen() {
  const navigation = useNavigation();
  const { t } = useI18n();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();
    if (!trimmedSubject || !trimmedMessage) {
      setError(t('contactMaster.required'));
      return;
    }

    setSending(true);
    setError(null);
    try {
      await createContactMessage(trimmedSubject, trimmedMessage);
      navigation.goBack();
      Alert.alert(t('contactMaster.sentTitle'), t('contactMaster.sentBody'));
    } catch {
      setError(t('contactMaster.failed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.muted} />
            <Text style={styles.backText}>{t('nav.profile')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('contactMaster.title')}</Text>
          <Text style={styles.subtitle}>{t('contactMaster.subtitle')}</Text>
        </View>

        <View style={styles.form}>
          <View>
            <Text style={styles.label}>{t('contactMaster.subject')}</Text>
            <TextInput
              autoCapitalize="sentences"
              maxLength={120}
              onChangeText={setSubject}
              placeholder={t('contactMaster.subjectPlaceholder')}
              placeholderTextColor={colors.dim}
              style={styles.input}
              value={subject}
            />
          </View>

          <View style={styles.messageBlock}>
            <Text style={styles.label}>{t('contactMaster.message')}</Text>
            <TextInput
              maxLength={2000}
              multiline
              onChangeText={setMessage}
              placeholder={t('contactMaster.messagePlaceholder')}
              placeholderTextColor={colors.dim}
              style={[styles.input, styles.messageInput]}
              textAlignVertical="top"
              value={message}
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={sending}
            onPress={handleSend}
            style={[styles.sendButton, sending && styles.disabledButton]}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={16} color="#fff" />
                <Text style={styles.sendText}>{t('contactMaster.send')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  keyboard: { flex: 1 },
  header: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginBottom: 14 },
  backText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 13 },
  title: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginTop: 4, lineHeight: 19 },
  form: { flex: 1, padding: 18, paddingTop: 0, gap: 14 },
  label: {
    color: colors.dim,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageBlock: { flex: 1, minHeight: 220 },
  messageInput: { flex: 1, lineHeight: 21 },
  errorText: { color: colors.danger, fontFamily: fonts.body, fontSize: 12 },
  sendButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  disabledButton: { opacity: 0.7 },
  sendText: { color: '#fff', fontFamily: fonts.bodyMedium, fontSize: 15, fontWeight: '700' },
});

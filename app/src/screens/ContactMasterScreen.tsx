import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ContactMessage } from '../types';
import { createContactMessage, fetchMyContactMessages, replyToContactMessage } from '../api/contactMessages';
import { useAuthStore } from '../store/authStore';
import { colors, fonts } from '../theme';
import { useI18n } from '../i18n';

function formatDate(value: string, locale: string): string {
  return new Date(value).toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function latestPreview(message: ContactMessage): string {
  const latestReply = message.replies[message.replies.length - 1];
  return latestReply?.message ?? message.message;
}

export default function ContactMasterScreen() {
  const navigation = useNavigation();
  const { t, locale } = useI18n();
  const user = useAuthStore((s) => s.user);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<ContactMessage[]>([]);
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [replyText, setReplyText] = useState('');

  const loadThreads = useCallback(async () => {
    const response = await fetchMyContactMessages();
    setThreads(response.messages);
  }, []);

  useEffect(() => {
    loadThreads().catch(() => {});
  }, [loadThreads]);

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

  const handleReply = async () => {
    if (!selected || !replyText.trim()) return;
    setSending(true);
    try {
      const response = await replyToContactMessage(selected.id, replyText.trim());
      setReplyText('');
      setSelected(response.message);
      setThreads((current) => current.map((thread) => (thread.id === response.message.id ? response.message : thread)));
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

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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

          {threads.length > 0 && (
            <View style={styles.history}>
              <Text style={styles.label}>{t('contactMaster.previousMessages')}</Text>
              {threads.map((thread) => (
                <TouchableOpacity
                  key={thread.id}
                  activeOpacity={0.85}
                  style={styles.threadCard}
                  onPress={() => {
                    setReplyText('');
                    setSelected(thread);
                  }}
                >
                  <View style={styles.threadTitleRow}>
                    <Text style={styles.threadSubject} numberOfLines={1}>{thread.subject}</Text>
                    <Text style={[styles.statusPill, thread.status === 'resolved' && styles.statusResolved]}>
                      {t(`adminContact.status.${thread.status}`)}
                    </Text>
                  </View>
                  <Text style={styles.threadDate}>{formatDate(thread.updatedAt, locale)}</Text>
                  <Text style={styles.threadPreview} numberOfLines={2}>{latestPreview(thread)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          {selected && (
            <View style={styles.detailPanel}>
              <View style={styles.detailHeader}>
                <View style={styles.detailNameBlock}>
                  <Text style={styles.detailSubject} numberOfLines={1}>{selected.subject}</Text>
                  <Text style={styles.detailMeta}>{formatDate(selected.createdAt, locale)}</Text>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setSelected(null)}>
                  <Ionicons name="close" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.chatBubble}>
                  <Text style={styles.chatAuthor}>{t('common.you')}</Text>
                  <Text style={styles.chatText}>{selected.message}</Text>
                  <Text style={styles.chatTime}>{formatDate(selected.createdAt, locale)}</Text>
                </View>
                {selected.replies.map((reply) => {
                  const fromMe = reply.sender?.id === user?.id;
                  return (
                    <View key={reply.id} style={[styles.chatBubble, !fromMe && styles.chatBubbleMaster]}>
                      <Text style={styles.chatAuthor}>{fromMe ? t('common.you') : t('adminContact.master')}</Text>
                      <Text style={styles.chatText}>{reply.message}</Text>
                      <Text style={styles.chatTime}>{formatDate(reply.createdAt, locale)}</Text>
                    </View>
                  );
                })}
                <View style={styles.replyBox}>
                  <TextInput
                    multiline
                    maxLength={2000}
                    onChangeText={setReplyText}
                    placeholder={t('contactMaster.replyPlaceholder')}
                    placeholderTextColor={colors.dim}
                    style={styles.replyInput}
                    textAlignVertical="top"
                    value={replyText}
                  />
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={sending || !replyText.trim()}
                    onPress={handleReply}
                    style={[styles.sendButton, (!replyText.trim() || sending) && styles.disabledButton]}
                  >
                    <Ionicons name="send" size={16} color="#fff" />
                    <Text style={styles.sendText}>{t('contactMaster.reply')}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  keyboard: { flex: 1 },
  scroll: { padding: 18, paddingTop: 0, paddingBottom: 28, gap: 20 },
  header: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginBottom: 14 },
  backText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 13 },
  title: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginTop: 4, lineHeight: 19 },
  form: { gap: 14 },
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
  messageBlock: { minHeight: 220 },
  messageInput: { minHeight: 220, lineHeight: 21 },
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
  history: { gap: 10 },
  threadCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  threadTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  threadSubject: { color: colors.text, flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, fontWeight: '700' },
  threadDate: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 3 },
  threadPreview: { color: colors.dim, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: 6 },
  statusPill: {
    color: colors.accent,
    backgroundColor: colors.accentDim,
    borderRadius: 8,
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 2,
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    fontWeight: '700',
  },
  statusResolved: { color: colors.muted, backgroundColor: 'rgba(255,255,255,0.06)' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.62)' },
  detailPanel: {
    maxHeight: '82%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  detailHeader: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailNameBlock: { flex: 1, minWidth: 0 },
  detailSubject: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 21, fontWeight: '700' },
  detailMeta: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailScroll: { padding: 18, paddingBottom: 28, gap: 18 },
  chatBubble: {
    alignSelf: 'flex-end',
    maxWidth: '92%',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 4,
  },
  chatBubbleMaster: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentDim,
    borderColor: 'rgba(102,112,255,0.32)',
  },
  chatAuthor: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 11, fontWeight: '700' },
  chatText: { color: colors.text, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  chatTime: { color: colors.dim, fontFamily: fonts.body, fontSize: 10 },
  replyBox: { gap: 10 },
  replyInput: {
    minHeight: 92,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});

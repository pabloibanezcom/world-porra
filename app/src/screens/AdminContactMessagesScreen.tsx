import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
import { ContactMessage, ContactMessageStatus } from '../types';
import { fetchAdminContactMessages, replyToContactMessage, updateAdminContactMessageStatus } from '../api/contactMessages';
import Avatar from '../components/ui/Avatar';
import { colors, fonts } from '../theme';
import { useI18n } from '../i18n';

const filters: Array<ContactMessageStatus | 'all'> = ['all', 'new', 'read', 'resolved'];

function formatDate(value: string, locale: string): string {
  return new Date(value).toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function latestPreview(message: ContactMessage): string {
  const latestReply = message.replies[message.replies.length - 1];
  return latestReply?.message ?? message.message;
}

export default function AdminContactMessagesScreen() {
  const navigation = useNavigation();
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [filter, setFilter] = useState<ContactMessageStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [updating, setUpdating] = useState(false);
  const [replyText, setReplyText] = useState('');

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchAdminContactMessages(filter === 'all' ? undefined : filter);
      setMessages(response.messages);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadMessages().catch(() => setLoading(false));
  }, [loadMessages]);

  const newCount = useMemo(() => messages.filter((message) => message.status === 'new').length, [messages]);

  const updateStatus = async (status: ContactMessageStatus) => {
    if (!selected) return;
    setUpdating(true);
    try {
      const response = await updateAdminContactMessageStatus(selected.id, status);
      setSelected(response.message);
      setMessages((current) => current.map((message) => (message.id === response.message.id ? response.message : message)));
    } finally {
      setUpdating(false);
    }
  };

  const sendReply = async () => {
    if (!selected || !replyText.trim()) return;
    setUpdating(true);
    try {
      const response = await replyToContactMessage(selected.id, replyText.trim());
      setReplyText('');
      setSelected(response.message);
      setMessages((current) => current.map((message) => (message.id === response.message.id ? response.message : message)));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.muted} />
          <Text style={styles.backText}>{t('profile.admin')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('adminContact.title')}</Text>
        <Text style={styles.subtitle}>{t('adminContact.subtitle', { count: messages.length, newCount })}</Text>
      </View>

      <View style={styles.filters}>
        {filters.map((item) => (
          <TouchableOpacity
            key={item}
            activeOpacity={0.85}
            onPress={() => setFilter(item)}
            style={[styles.filterButton, filter === item && styles.filterButtonActive]}
          >
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>
              {t(`adminContact.filter.${item}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {messages.map((message) => (
            <TouchableOpacity key={message.id} activeOpacity={0.85} style={styles.messageCard} onPress={() => {
              setReplyText('');
              setSelected(message);
            }}>
              <Avatar name={message.user?.name ?? '?'} color={message.status === 'new' ? colors.accent : colors.blue} imageUrl={message.user?.avatarUrl} size={42} />
              <View style={styles.messageMain}>
                <View style={styles.messageTitleRow}>
                  <Text style={styles.messageSubject} numberOfLines={1}>{message.subject}</Text>
                  <Text style={[styles.statusPill, message.status === 'resolved' && styles.statusResolved]}>
                    {t(`adminContact.status.${message.status}`)}
                  </Text>
                </View>
                <Text style={styles.messageUser} numberOfLines={1}>{message.user?.name ?? t('adminContact.unknownUser')} · {formatDate(message.createdAt, locale)}</Text>
                <Text style={styles.messagePreview} numberOfLines={2}>{latestPreview(message)}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {messages.length === 0 && <Text style={styles.empty}>{t('adminContact.empty')}</Text>}
        </ScrollView>
      )}

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          {selected && (
            <View style={styles.detailPanel}>
              <View style={styles.detailHeader}>
                <View style={styles.detailIdentity}>
                  <Avatar name={selected.user?.name ?? '?'} color={colors.accent} imageUrl={selected.user?.avatarUrl} size={48} />
                  <View style={styles.detailNameBlock}>
                    <Text style={styles.detailSubject} numberOfLines={1}>{selected.subject}</Text>
                    <Text style={styles.detailMeta} numberOfLines={1}>
                      {selected.user?.email ?? t('adminContact.unknownUser')} · {formatDate(selected.createdAt, locale)}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={() => {
                  setReplyText('');
                  setSelected(null);
                }}>
                  <Ionicons name="close" size={18} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.chatBubble}>
                  <Text style={styles.chatAuthor}>{selected.user?.name ?? t('adminContact.unknownUser')}</Text>
                  <Text style={styles.chatText}>{selected.message}</Text>
                  <Text style={styles.chatTime}>{formatDate(selected.createdAt, locale)}</Text>
                </View>
                {selected.replies.map((reply) => {
                  const fromUser = reply.sender?.id === selected.user?.id;
                  return (
                    <View key={reply.id} style={[styles.chatBubble, !fromUser && styles.chatBubbleMaster]}>
                      <Text style={styles.chatAuthor}>
                        {fromUser ? selected.user?.name ?? t('adminContact.unknownUser') : t('adminContact.master')}
                      </Text>
                      <Text style={styles.chatText}>{reply.message}</Text>
                      <Text style={styles.chatTime}>{formatDate(reply.createdAt, locale)}</Text>
                    </View>
                  );
                })}
                <View style={styles.actions}>
                  {(['read', 'resolved'] as ContactMessageStatus[]).map((status) => (
                    <TouchableOpacity
                      key={status}
                      activeOpacity={0.85}
                      disabled={updating || selected.status === status}
                      onPress={() => updateStatus(status)}
                      style={[styles.actionButton, selected.status === status && styles.actionButtonActive]}
                    >
                      <Text style={[styles.actionText, selected.status === status && styles.actionTextActive]}>
                        {t(`adminContact.mark.${status}`)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.replyBox}>
                  <TextInput
                    multiline
                    maxLength={2000}
                    onChangeText={setReplyText}
                    placeholder={t('adminContact.replyPlaceholder')}
                    placeholderTextColor={colors.dim}
                    style={styles.replyInput}
                    textAlignVertical="top"
                    value={replyText}
                  />
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={updating || !replyText.trim()}
                    onPress={sendReply}
                    style={[styles.replyButton, (!replyText.trim() || updating) && styles.replyButtonDisabled]}
                  >
                    <Ionicons name="send" size={15} color="#fff" />
                    <Text style={styles.replyButtonText}>{t('adminContact.reply')}</Text>
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
  header: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 14 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginBottom: 14 },
  backText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 13 },
  title: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 28, fontWeight: '700' },
  subtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginTop: 4 },
  filters: { flexDirection: 'row', paddingHorizontal: 18, gap: 8, marginBottom: 12 },
  filterButton: {
    borderRadius: 999,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 12, fontWeight: '700' },
  filterTextActive: { color: '#fff' },
  list: { padding: 18, paddingTop: 0, paddingBottom: 28, gap: 10 },
  messageCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
  },
  messageMain: { flex: 1, minWidth: 0 },
  messageTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  messageSubject: { color: colors.text, flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, fontWeight: '700' },
  messageUser: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 3 },
  messagePreview: { color: colors.dim, fontFamily: fonts.body, fontSize: 12, marginTop: 6, lineHeight: 17 },
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
  empty: { color: colors.muted, fontFamily: fonts.body, textAlign: 'center', marginTop: 36 },
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
  detailIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
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
    alignSelf: 'flex-start',
    maxWidth: '92%',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 4,
  },
  chatBubbleMaster: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accentDim,
    borderColor: 'rgba(102,112,255,0.32)',
  },
  chatAuthor: { color: colors.muted, fontFamily: fonts.bodyMedium, fontSize: 11, fontWeight: '700' },
  chatText: { color: colors.text, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  chatTime: { color: colors.dim, fontFamily: fonts.body, fontSize: 10 },
  actions: { flexDirection: 'row', gap: 10 },
  actionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  actionButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  actionText: { color: colors.text, fontFamily: fonts.bodyMedium, fontSize: 13, fontWeight: '700' },
  actionTextActive: { color: '#fff' },
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
  replyButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  replyButtonDisabled: { opacity: 0.6 },
  replyButtonText: { color: '#fff', fontFamily: fonts.bodyMedium, fontSize: 13, fontWeight: '700' },
});

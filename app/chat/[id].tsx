import { Link, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Image, Info, Mic, Send, Sparkles } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';

import { ChatBubble } from '@/components/ChatBubble';
import { GlassCard } from '@/components/GlassCard';
import { Screen } from '@/components/Screen';
import { useChatMessages, useExProfile } from '@/features/exes/hooks';
import {
  addAssistantMessage,
  addUserMessage,
  getRecentMessagesForPrompt,
} from '@/features/exes/repository';
import { buildChatPrompt } from '@/features/chat/prompt';
import { generateChatReply } from '@/lib/openai/client';
import { getApiSettings } from '@/lib/settings/apiSettings';
import { palette } from '@/theme/palette';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: ex, error: profileError, loading: profileLoading } = useExProfile(id);
  const {
    data: messages,
    error: messagesError,
    loading: messagesLoading,
    reload: reloadMessages,
  } = useChatMessages(id);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [proactiveStatus, setProactiveStatus] = useState('主动消息队列会根据未回复时间、情绪和免打扰时间生成。');

  async function handleSend() {
    const content = draft.trim();
    if (!id || !content || sending) {
      return;
    }

    const currentProfile = ex;
    if (!currentProfile) {
      setSendError('角色还没有加载完成');
      return;
    }

    try {
      setSending(true);
      setSendError(null);
      setDraft('');
      await addUserMessage(id, content);
      reloadMessages();
      const [profile, settings, recentMessages] = await Promise.all([
        Promise.resolve(currentProfile),
        getApiSettings(),
        getRecentMessagesForPrompt(id),
      ]);
      const prompt = buildChatPrompt(profile, recentMessages);
      const reply = await generateChatReply(settings, prompt);
      await addAssistantMessage(id, reply || '我不知道该怎么回你。');
      reloadMessages();
    } catch (caught) {
      setSendError(caught instanceof Error ? caught.message : '发送失败');
    } finally {
      setSending(false);
    }
  }

  async function handleManualProactive() {
    if (!ex) {
      return;
    }

    try {
      setProactiveStatus('她正在想要不要主动说点什么...');
      const proactiveQueue = await import('@/features/proactive/queue');
      await proactiveQueue.letHerSaySomethingNow(ex);
      reloadMessages();
      setProactiveStatus('她主动发了一句。');
    } catch (caught) {
      setProactiveStatus(caught instanceof Error ? caught.message : '主动消息失败');
    }
  }

  async function handleScheduleProactive() {
    if (!ex) {
      return;
    }

    try {
      setProactiveStatus('正在安排未来主动消息...');
      const proactiveQueue = await import('@/features/proactive/queue');
      const count = await proactiveQueue.scheduleUpcomingProactiveMessages(ex);
      setProactiveStatus(`已安排 ${count} 条未来主动消息。`);
    } catch (caught) {
      setProactiveStatus(caught instanceof Error ? caught.message : '安排主动消息失败');
    }
  }

  if (profileLoading || !ex) {
    return (
      <Screen>
        <Text style={styles.stateText}>{profileError ?? '正在读取角色...'}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Link href="/" asChild>
          <Pressable style={styles.iconButton}>
            <ArrowLeft color={palette.text} size={21} />
          </Pressable>
        </Link>
        <View style={styles.person}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{ex.avatar}</Text>
          </View>
          <View>
            <Text style={styles.name}>{ex.name}</Text>
            <Text style={styles.status}>关系温度 {ex.temperature} · {ex.mood}</Text>
          </View>
        </View>
        <Link href={`/ex/${ex.id}`} asChild>
          <Pressable style={styles.iconButton}>
            <Info color={palette.text} size={21} />
          </Pressable>
        </Link>
      </View>

      <ScrollView contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
        <Text style={styles.dayLabel}>今天</Text>
        {messagesLoading ? <Text style={styles.stateText}>正在读取聊天记录...</Text> : null}
        {messagesError ? <Text style={styles.stateText}>{messagesError}</Text> : null}
        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} />
        ))}
        {sending ? <Text style={styles.stateText}>她正在想怎么回...</Text> : null}
        {sendError ? <Text style={styles.errorText}>{sendError}</Text> : null}
        <GlassCard style={styles.proactiveHint}>
          <Sparkles color={palette.accent} size={16} />
          <View style={styles.proactiveBody}>
            <Text style={styles.hintText}>{proactiveStatus}</Text>
            <View style={styles.proactiveActions}>
              <Pressable onPress={handleManualProactive} style={styles.proactiveButton}>
                <Text style={styles.proactiveButtonText}>让她说一句</Text>
              </Pressable>
              <Pressable onPress={handleScheduleProactive} style={styles.proactiveButton}>
                <Text style={styles.proactiveButtonText}>安排未来消息</Text>
              </Pressable>
            </View>
          </View>
        </GlassCard>
      </ScrollView>

      <GlassCard style={styles.composer}>
        <Pressable style={styles.toolButton}>
          <Image color={palette.subtle} size={20} />
        </Pressable>
        <TextInput
          onChangeText={setDraft}
          placeholder="说点什么..."
          placeholderTextColor={palette.muted}
          style={styles.input}
          value={draft}
        />
        <Pressable style={styles.toolButton}>
          <Mic color={palette.subtle} size={20} />
        </Pressable>
        <Pressable
          disabled={!draft.trim() || sending}
          onPress={handleSend}
          style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonDisabled]}
        >
          <Send color={palette.text} size={19} />
        </Pressable>
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  stateText: {
    color: palette.subtle,
    fontSize: 14,
    lineHeight: 21,
    padding: 18,
  },
  errorText: {
    color: palette.accentSoft,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 18,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: palette.glassStrong,
    borderColor: palette.stroke,
    borderRadius: 17,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  person: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 11,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: palette.avatar,
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  avatarText: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  name: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  status: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 2,
  },
  messages: {
    gap: 12,
    paddingBottom: 16,
  },
  dayLabel: {
    alignSelf: 'center',
    color: palette.muted,
    fontSize: 12,
    marginBottom: 2,
  },
  proactiveHint: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  hintText: {
    color: palette.subtle,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  proactiveBody: {
    flex: 1,
    gap: 9,
  },
  proactiveActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  proactiveButton: {
    backgroundColor: palette.input,
    borderColor: palette.stroke,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  proactiveButtonText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '800',
  },
  composer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toolButton: {
    alignItems: 'center',
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  input: {
    color: palette.text,
    flex: 1,
    fontSize: 15,
    minHeight: 36,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: palette.accent,
    borderRadius: 16,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});

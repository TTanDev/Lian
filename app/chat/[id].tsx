import { Link, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Image, Info, Mic, Send, Sparkles } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ChatBubble } from '@/components/ChatBubble';
import { GlassCard } from '@/components/GlassCard';
import { Screen } from '@/components/Screen';
import { useChatMessages, useExProfile } from '@/features/exes/hooks';
import { palette } from '@/theme/palette';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: ex, error: profileError, loading: profileLoading } = useExProfile(id);
  const { data: messages, error: messagesError, loading: messagesLoading } = useChatMessages(id);

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
        <GlassCard style={styles.proactiveHint}>
          <Sparkles color={palette.accent} size={16} />
          <Text style={styles.hintText}>主动消息队列会根据未回复时间、情绪和免打扰时间生成。</Text>
        </GlassCard>
      </ScrollView>

      <GlassCard style={styles.composer}>
        <Pressable style={styles.toolButton}>
          <Image color={palette.subtle} size={20} />
        </Pressable>
        <TextInput
          placeholder="说点什么..."
          placeholderTextColor={palette.muted}
          style={styles.input}
        />
        <Pressable style={styles.toolButton}>
          <Mic color={palette.subtle} size={20} />
        </Pressable>
        <Pressable style={styles.sendButton}>
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
});

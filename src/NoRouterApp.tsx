import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { buildChatPrompt } from '@/features/chat/prompt';
import {
  addAssistantMessage,
  addUserMessage,
  createExProfile,
  getExProfile,
  getExProfiles,
  getMessages,
  getRecentMessagesForPrompt,
} from '@/features/exes/repository';
import { ChatMessage, ExProfile, ExProfileDetail } from '@/features/exes/types';
import { generateChatReply, testOpenAIConnection } from '@/lib/openai/client';
import { ApiSettings, getApiSettings, saveApiSettings } from '@/lib/settings/apiSettings';
import { palette } from '@/theme/palette';

type ScreenState =
  | { name: 'home' }
  | { name: 'chat'; id: string }
  | { name: 'settings' }
  | { name: 'new' };

const emptySettings: ApiSettings = {
  apiKey: '',
  baseUrl: '',
  model: 'mimo2.5',
};

export default function NoRouterApp() {
  const [screen, setScreen] = useState<ScreenState>({ name: 'home' });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      {screen.name === 'home' ? <HomeScreen navigate={setScreen} /> : null}
      {screen.name === 'chat' ? <ChatScreen id={screen.id} navigate={setScreen} /> : null}
      {screen.name === 'settings' ? <SettingsScreen navigate={setScreen} /> : null}
      {screen.name === 'new' ? <NewProfileScreen navigate={setScreen} /> : null}
    </SafeAreaView>
  );
}

function HomeScreen({ navigate }: { navigate: (screen: ScreenState) => void }) {
  const [profiles, setProfiles] = useState<ExProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const rows = await getExProfiles();
        if (!cancelled) {
          setProfiles(rows);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : '读取她的列表失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScreenFrame>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>恋</Text>
          <Text style={styles.title}>她</Text>
        </View>
        <View style={styles.headerActions}>
          <RoundButton label="设" onPress={() => navigate({ name: 'settings' })} />
          <RoundButton label="+" primary onPress={() => navigate({ name: 'new' })} />
        </View>
      </View>

      {loading ? <LoadingLine text="正在读取本地数据..." /> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {profiles.map((profile, index) => (
          <StaggeredItem key={profile.id} index={index}>
          <PressableScale onPress={() => navigate({ name: 'chat', id: profile.id })}>
            <View style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{profile.avatar}</Text>
              </View>
              <View style={styles.cardBody}>
                <View style={styles.row}>
                  <Text style={styles.name}>{profile.name}</Text>
                  <Text style={styles.time}>{profile.lastMessageAt}</Text>
                </View>
                <Text style={styles.preview} numberOfLines={1}>
                  {profile.lastMessage}
                </Text>
                <Text style={styles.metaText}>关系温度 {profile.temperature} · {profile.mood}</Text>
              </View>
            </View>
          </PressableScale>
          </StaggeredItem>
        ))}
      </ScrollView>
    </ScreenFrame>
  );
}

function ChatScreen({
  id,
  navigate,
}: {
  id: string;
  navigate: (screen: ScreenState) => void;
}) {
  const [profile, setProfile] = useState<ExProfileDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [nextProfile, nextMessages] = await Promise.all([getExProfile(id), getMessages(id)]);
      setProfile(nextProfile);
      setMessages(nextMessages);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '读取聊天失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function send() {
    const content = draft.trim();
    if (!content || !profile || sending) {
      return;
    }

    try {
      setSending(true);
      setError(null);
      setDraft('');
      await addUserMessage(id, content);
      const [settings, recentMessages] = await Promise.all([
        getApiSettings(),
        getRecentMessagesForPrompt(id),
      ]);
      const prompt = buildChatPrompt(profile, recentMessages);
      const reply = await generateChatReply(settings, prompt);
      await addAssistantMessage(id, cleanupChatReply(reply) || '我不知道该怎么回你。');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '发送失败');
      await load();
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScreenFrame compact>
        <View style={styles.chatHeader}>
          <RoundButton label="‹" onPress={() => navigate({ name: 'home' })} />
          <View style={styles.chatTitleBox}>
            <Text style={styles.name}>{profile?.name ?? '她'}</Text>
            <Text style={styles.metaText}>
              {profile ? `关系温度 ${profile.temperature} · ${profile.mood}` : '正在读取...'}
            </Text>
          </View>
        </View>

        {loading ? <LoadingLine text="正在读取聊天记录..." /> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <ScrollView contentContainerStyle={styles.messages} showsVerticalScrollIndicator={false}>
          {messages.map((message, index) => (
            <StaggeredItem key={message.id} index={index} compact>
            <Animated.View
              key={message.id}
              style={[
                styles.bubble,
                message.role === 'user' ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <Text style={styles.bubbleText}>{message.content}</Text>
              <Text style={styles.bubbleTime}>{message.time}</Text>
            </Animated.View>
            </StaggeredItem>
          ))}
          {sending ? <LoadingLine text="她正在想怎么回..." /> : null}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            onChangeText={setDraft}
            placeholder="说点什么..."
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={draft}
          />
          <PressableScale disabled={!draft.trim() || sending} onPress={send} style={styles.sendButton}>
            <Text style={styles.sendButtonText}>发</Text>
          </PressableScale>
        </View>
      </ScreenFrame>
    </KeyboardAvoidingView>
  );
}

function SettingsScreen({ navigate }: { navigate: (screen: ScreenState) => void }) {
  const [settings, setSettings] = useState<ApiSettings>(emptySettings);
  const [status, setStatus] = useState('API 地址、Key 和模型只保存在本机。');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getApiSettings()
      .then(setSettings)
      .catch((caught) => setStatus(caught instanceof Error ? caught.message : '读取设置失败'));
  }, []);

  const canTest = useMemo(
    () => Boolean(settings.baseUrl.trim() && settings.apiKey.trim() && settings.model.trim()),
    [settings]
  );

  async function save() {
    try {
      setSaving(true);
      await saveApiSettings(settings);
      setStatus('已保存。');
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    try {
      setSaving(true);
      await saveApiSettings(settings);
      const message = await testOpenAIConnection(settings);
      setStatus(message);
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : '测试失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenFrame>
      <View style={styles.chatHeader}>
        <RoundButton label="‹" onPress={() => navigate({ name: 'home' })} />
        <View>
          <Text style={styles.titleSmall}>设置</Text>
          <Text style={styles.metaText}>OpenAI 兼容协议</Text>
        </View>
      </View>

      <Field
        label="API Base URL"
        onChangeText={(baseUrl) => setSettings((current) => ({ ...current, baseUrl }))}
        placeholder="https://api.example.com/v1"
        value={settings.baseUrl}
      />
      <Field
        label="API Key"
        onChangeText={(apiKey) => setSettings((current) => ({ ...current, apiKey }))}
        placeholder="sk-..."
        secureTextEntry
        value={settings.apiKey}
      />
      <Field
        label="模型"
        onChangeText={(model) => setSettings((current) => ({ ...current, model }))}
        placeholder="mimo2.5"
        value={settings.model}
      />

      <Text style={styles.statusText}>{status}</Text>
      <View style={styles.actionRow}>
        <PressableScale disabled={saving} onPress={save} style={styles.primaryAction}>
          <Text style={styles.primaryActionText}>{saving ? '处理中...' : '保存'}</Text>
        </PressableScale>
        <PressableScale disabled={!canTest || saving} onPress={test} style={styles.secondaryAction}>
          <Text style={styles.primaryActionText}>测试连接</Text>
        </PressableScale>
      </View>
    </ScreenFrame>
  );
}

function NewProfileScreen({ navigate }: { navigate: (screen: ScreenState) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('先添加一个“她”，之后再导入资料学习。');
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!name.trim()) {
      setStatus('先写一个名字。');
      return;
    }

    try {
      setSaving(true);
      const created = await createExProfile({
        avatar: name.trim().slice(0, 1),
        description: description.trim() || '等待补充资料学习。',
        mood: '平静',
        name: name.trim(),
        temperature: 50,
      });
      navigate({ name: 'chat', id: created.id });
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : '创建失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenFrame>
      <View style={styles.chatHeader}>
        <RoundButton label="‹" onPress={() => navigate({ name: 'home' })} />
        <View>
          <Text style={styles.titleSmall}>添加她</Text>
          <Text style={styles.metaText}>创建一个新的角色档案</Text>
        </View>
      </View>

      <Field label="名字" onChangeText={setName} placeholder="比如：林雨" value={name} />
      <Field
        label="主观描述"
        multiline
        onChangeText={setDescription}
        placeholder="她的性格、说话方式、你们的关系背景..."
        value={description}
      />
      <Text style={styles.statusText}>{status}</Text>
      <PressableScale disabled={saving} onPress={create} style={styles.primaryAction}>
        <Text style={styles.primaryActionText}>{saving ? '创建中...' : '创建'}</Text>
      </PressableScale>
    </ScreenFrame>
  );
}

function ScreenFrame({
  children,
  compact,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.screen,
        compact && styles.screenCompact,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function Field({
  label,
  ...props
}: {
  label: string;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={palette.muted}
        style={[styles.fieldInput, props.multiline && styles.fieldInputMultiline]}
        {...props}
      />
    </View>
  );
}

function LoadingLine({ text }: { text: string }) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          duration: 720,
          easing: Easing.inOut(Easing.quad),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          duration: 720,
          easing: Easing.inOut(Easing.quad),
          toValue: 0.35,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.loadingLine, { opacity }]}>
      <ActivityIndicator color={palette.accent} size="small" />
      <Text style={styles.stateText}>{text}</Text>
    </Animated.View>
  );
}

function RoundButton({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <PressableScale onPress={onPress} style={[styles.roundButton, primary && styles.roundButtonPrimary]}>
      <Text style={styles.roundButtonText}>{label}</Text>
    </PressableScale>
  );
}

function cleanupChatReply(reply: string) {
  return reply
    .trim()
    .replace(/^["“”]+|["“”]+$/g, '')
    .replace(/^(?:她|助手|assistant|AI)\s*[:：]\s*/i, '')
    .replace(/^(?:\[\s*)?(?:今天|昨天|前天)?\s*\d{1,2}[:：]\d{2}(?:\s*\])?\s*[，,。:：、-]?\s*/u, '')
    .replace(/^\[\s*(?:\d{1,2}[:：]\d{2}\s*)+\]\s*/u, '')
    .trim();
}

function PressableScale({
  children,
  disabled,
  onPress,
  style,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onPress: () => void;
  style?: React.ComponentProps<typeof Pressable>['style'];
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function animate(toValue: number, duration: number) {
    Animated.timing(scale, {
      duration,
      easing: Easing.out(Easing.cubic),
      toValue,
      useNativeDriver: true,
    }).start();
  }

  return (
    <Animated.View style={[disabled && styles.disabled, { transform: [{ scale }] }]}>
      <Pressable
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => animate(0.94, 105)}
        onPressOut={() => animate(1, 150)}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function StaggeredItem({
  children,
  compact,
  index,
}: {
  children: React.ReactNode;
  compact?: boolean;
  index: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(compact ? 8 : 18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        delay: Math.min(index * 45, 220),
        duration: compact ? 180 : 260,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        delay: Math.min(index * 45, 220),
        duration: compact ? 210 : 300,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [compact, index, opacity, translateY]);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
      }}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: palette.background,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  screen: {
    backgroundColor: palette.background,
    flex: 1,
    padding: 22,
  },
  screenCompact: {
    paddingBottom: 10,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  kicker: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  title: {
    color: palette.text,
    fontSize: 34,
    fontWeight: '800',
    marginTop: 4,
  },
  titleSmall: {
    color: palette.text,
    fontSize: 25,
    fontWeight: '800',
  },
  list: {
    gap: 14,
    paddingBottom: 28,
  },
  card: {
    alignItems: 'center',
    backgroundColor: palette.glassStrong,
    borderColor: palette.stroke,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: palette.avatar,
    borderRadius: 24,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  avatarText: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '800',
  },
  cardBody: {
    flex: 1,
    gap: 7,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  name: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  time: {
    color: palette.muted,
    fontSize: 12,
  },
  preview: {
    color: palette.subtle,
    fontSize: 14,
  },
  metaText: {
    color: palette.muted,
    fontSize: 12,
  },
  chatHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  chatTitleBox: {
    flex: 1,
  },
  messages: {
    flexGrow: 1,
    gap: 12,
    paddingBottom: 16,
  },
  bubble: {
    borderRadius: 18,
    maxWidth: '84%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: palette.assistantBubble,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: palette.userBubble,
  },
  bubbleText: {
    color: palette.text,
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleTime: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 5,
  },
  composer: {
    alignItems: 'center',
    backgroundColor: palette.glassStrong,
    borderColor: palette.stroke,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    width: 42,
  },
  disabled: {
    opacity: 0.48,
  },
  sendButtonText: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  field: {
    gap: 8,
    marginBottom: 14,
  },
  fieldLabel: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
  },
  fieldInput: {
    backgroundColor: palette.input,
    borderColor: palette.stroke,
    borderRadius: 16,
    borderWidth: 1,
    color: palette.text,
    fontSize: 14,
    minHeight: 46,
    paddingHorizontal: 13,
  },
  fieldInputMultiline: {
    minHeight: 112,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  loadingLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  stateText: {
    color: palette.subtle,
    fontSize: 14,
    lineHeight: 21,
  },
  errorText: {
    color: palette.accentSoft,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  statusText: {
    color: palette.subtle,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: palette.accent,
    borderRadius: 18,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: palette.input,
    borderColor: palette.stroke,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryActionText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
  },
  roundButton: {
    alignItems: 'center',
    backgroundColor: palette.glassStrong,
    borderColor: palette.stroke,
    borderRadius: 18,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  roundButtonPrimary: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  roundButtonText: {
    color: palette.text,
    fontSize: 19,
    fontWeight: '800',
  },
});

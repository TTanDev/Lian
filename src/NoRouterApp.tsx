import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { buildChatPrompt } from '@/features/chat/prompt';
import {
  addAssistantMessage,
  addUserMessage,
  addLearningSource,
  createExProfile,
  deleteExProfile,
  getExProfile,
  getExProfiles,
  getLearningSources,
  getMessages,
  getRecentMessagesForPrompt,
  markLearningSourcesLearned,
  updateExProfileMedia,
  updateSkillProfile,
} from '@/features/exes/repository';
import { ChatMessage, ExProfile, ExProfileDetail, LearningSource, LearningSourceType } from '@/features/exes/types';
import { pickDocumentSource, pickImageSource, pickImageSources } from '@/features/learning/importers';
import { buildSkillProfilePrompt, parseSkillProfileDraft } from '@/features/learning/skillProfile';
import { generateChatReply, generateStructuredText, testOpenAIConnection } from '@/lib/openai/client';
import { getThemeMode, saveThemeMode, ThemeMode } from '@/lib/settings/appearanceSettings';
import { ApiSettings, getApiSettings, saveApiSettings } from '@/lib/settings/apiSettings';
import { AppPalette, darkPalette, lightPalette } from '@/theme/palette';

type ScreenState =
  | { name: 'home' }
  | { name: 'chat'; id: string; search?: boolean }
  | { name: 'chatMenu'; id: string }
  | { name: 'learning'; id: string }
  | { name: 'settings' }
  | { name: 'new' };

type ThemeContextValue = {
  colors: AppPalette;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
  styles: ReturnType<typeof createStyles>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const emptySettings: ApiSettings = {
  apiKey: '',
  baseUrl: '',
  model: 'mimo2.5',
};

export default function NoRouterApp() {
  const [screen, setScreen] = useState<ScreenState>({ name: 'home' });
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const isLight = themeMode === 'light' || (themeMode === 'auto' && systemScheme === 'light');
  const colors = isLight ? lightPalette : darkPalette;
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    getThemeMode().then(setThemeMode).catch(() => setThemeMode('dark'));
  }, []);

  async function changeThemeMode(mode: ThemeMode) {
    setThemeMode(mode);
    await saveThemeMode(mode);
  }

  return (
    <ThemeContext.Provider value={{ colors, mode: themeMode, setMode: changeThemeMode, styles }}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={isLight ? 'dark' : 'light'} />
        {screen.name === 'home' ? <HomeScreen navigate={setScreen} /> : null}
        {screen.name === 'chat' ? <ChatScreen screen={screen} navigate={setScreen} /> : null}
        {screen.name === 'chatMenu' ? <ChatMenuScreen id={screen.id} navigate={setScreen} /> : null}
        {screen.name === 'learning' ? <LearningScreen id={screen.id} navigate={setScreen} /> : null}
        {screen.name === 'settings' ? <SettingsScreen navigate={setScreen} /> : null}
        {screen.name === 'new' ? <NewProfileScreen navigate={setScreen} /> : null}
      </SafeAreaView>
    </ThemeContext.Provider>
  );
}

function useAppTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('Theme context is missing');
  }

  return value;
}

function HomeScreen({ navigate }: { navigate: (screen: ScreenState) => void }) {
  const { styles } = useAppTheme();
  const [profiles, setProfiles] = useState<ExProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const rows = await getExProfiles();
      setProfiles(rows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '读取她的列表失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
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
          <PressableScale
            onPress={() => navigate({ name: 'chat', id: profile.id })}
          >
            <View style={styles.card}>
              <Avatar profile={profile} size={54} />
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
  screen,
  navigate,
}: {
  screen: Extract<ScreenState, { name: 'chat' }>;
  navigate: (screen: ScreenState) => void;
}) {
  const { colors, styles } = useAppTheme();
  const { id } = screen;
  const [profile, setProfile] = useState<ExProfileDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [toolPanel, setToolPanel] = useState<'emoji' | 'plus' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(Boolean(screen.search));
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);

  const filteredMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return messages;
    }

    return messages.filter((message) =>
      displayMessageContent(message).toLowerCase().includes(query)
    );
  }, [messages, searchQuery]);

  function scrollToBottom(animated = true) {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated }));
  }

  async function load(options?: { showSpinner?: boolean }) {
    try {
      if (options?.showSpinner !== false) {
        setLoading(true);
      }
      setError(null);
      const [nextProfile, nextMessages] = await Promise.all([getExProfile(id), getMessages(id)]);
      setProfile(nextProfile);
      setMessages(nextMessages);
      scrollToBottom(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '读取聊天失败');
    } finally {
      if (options?.showSpinner !== false) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if (screen.search) {
      setSearchVisible(true);
    }
  }, [screen.search]);

  useEffect(() => {
    scrollToBottom(false);
  }, [messages.length, searchQuery]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        load({ showSpinner: false });
        scrollToBottom(false);
      } else {
        Keyboard.dismiss();
      }
    });

    return () => subscription.remove();
  }, [id]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      setTimeout(() => scrollToBottom(true), 80);
      setTimeout(() => scrollToBottom(true), 260);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (toolPanel) {
      setTimeout(() => scrollToBottom(true), 80);
    }
  }, [toolPanel]);

  async function send() {
    const content = draft.trim();
    if ((!content && selectedImages.length === 0) || !profile || sending) {
      return;
    }

    try {
      setSending(true);
      setError(null);
      setDraft('');
      const imageUris = selectedImages;
      setSelectedImages([]);
      setToolPanel(null);
      const userMessage = await addUserMessage(id, content, { imageUris });
      setMessages((current) => [...current, userMessage]);
      scrollToBottom();
      const [settings, recentMessages] = await Promise.all([
        getApiSettings(),
        getRecentMessagesForPrompt(id),
      ]);
      const prompt = buildChatPrompt(profile, recentMessages);
      const reply = await generateChatReply(settings, prompt);
      const assistantMessage = await addAssistantMessage(
        id,
        cleanupChatReply(reply) || '我不知道该怎么回你。'
      );
      setMessages((current) => [...current, assistantMessage]);
      scrollToBottom();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '发送失败');
      await load({ showSpinner: false });
    } finally {
      setSending(false);
    }
  }

  async function pickChatImages() {
    try {
      Keyboard.dismiss();
      const picked = await pickImageSources('image', 9 - selectedImages.length);
      if (picked.length) {
        setSelectedImages((current) => [
          ...current,
          ...picked.map((item) => item.localUri),
        ].slice(0, 9));
        setToolPanel(null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '选择图片失败');
    }
  }

  function appendEmoji(emoji: string) {
    setDraft((current) => `${current}${emoji}`);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScreenFrame compact onSwipeBack={() => navigate({ name: 'home' })}>
        {profile?.chatBackgroundUri ? (
          <Image source={{ uri: profile.chatBackgroundUri }} style={styles.chatBackgroundImage} />
        ) : null}
        <View style={styles.chatHeader}>
          <RoundButton label="‹" onPress={() => navigate({ name: 'home' })} />
          <View style={styles.chatTitleBox}>
            <Text style={styles.name}>{profile?.name ?? '她'}</Text>
            <Text style={styles.metaText}>
              {sending ? '对方正在输入中' : profile ? `关系温度 ${profile.temperature} · ${profile.mood}` : '正在读取...'}
            </Text>
          </View>
          <RoundButton label="⋯" onPress={() => navigate({ name: 'chatMenu', id })} />
        </View>
        {searchVisible ? (
          <TextInput
            onChangeText={setSearchQuery}
            placeholder="搜索聊天记录..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            value={searchQuery}
          />
        ) : null}

        {loading ? <LoadingLine text="正在读取聊天记录..." /> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <ScrollView
          contentContainerStyle={[
            styles.messages,
            (keyboardVisible || toolPanel) && styles.messagesWithBottomControls,
          ]}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (!searchQuery.trim()) {
              scrollToBottom();
            }
          }}
          onLayout={() => scrollToBottom(false)}
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          style={styles.messageList}
        >
          {filteredMessages.map((message, index) => (
            <StaggeredItem key={message.id} index={index} compact>
              <MessageBubble message={message} />
            </StaggeredItem>
          ))}
          {searchQuery.trim() && filteredMessages.length === 0 ? (
            <Text style={styles.emptySearchText}>没有找到相关聊天记录。</Text>
          ) : null}
        </ScrollView>

        <View style={styles.composer}>
          <PressableScale onPress={() => setToolPanel((current) => current === 'plus' ? null : 'plus')} style={styles.composerIconButton}>
            <Text style={styles.composerIconText}>+</Text>
          </PressableScale>
          <TextInput
            onChangeText={setDraft}
            onFocus={() => setTimeout(() => scrollToBottom(true), 120)}
            placeholder="说点什么..."
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={draft}
          />
          <PressableScale onPress={() => setToolPanel((current) => current === 'emoji' ? null : 'emoji')} style={styles.composerIconButton}>
            <Text style={styles.composerIconText}>☺</Text>
          </PressableScale>
          {draft.trim() || selectedImages.length ? (
            <PressableScale disabled={sending} onPress={send} style={styles.sendButton}>
              <Text style={styles.sendButtonText}>发</Text>
            </PressableScale>
          ) : null}
        </View>
        {selectedImages.length ? (
          <View style={styles.selectedImageStrip}>
            {selectedImages.map((uri, index) => (
              <PressableScale
                key={`${uri}-${index}`}
                onPress={() => setSelectedImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                style={styles.selectedImageItem}
              >
                <Image source={{ uri }} style={styles.selectedImageThumb} />
                <Text style={styles.selectedImageRemove}>×</Text>
              </PressableScale>
            ))}
          </View>
        ) : null}
        {toolPanel === 'emoji' ? (
          <SlidingToolPanel>
            {['🙂', '😒', '🥺', '😂', '😉', '😤', '😭', '🫠', '❤️', '👌'].map((emoji) => (
              <PressableScale key={emoji} onPress={() => appendEmoji(emoji)} style={styles.emojiButton}>
                <Text style={styles.emojiText}>{emoji}</Text>
              </PressableScale>
            ))}
          </SlidingToolPanel>
        ) : null}
        {toolPanel === 'plus' ? (
          <SlidingToolPanel>
            <ToolTile label="照片" icon="▧" onPress={pickChatImages} />
            <ToolTile label="拍摄" icon="○" onPress={pickChatImages} />
            <ToolTile label="表情" icon="☺" onPress={() => setToolPanel('emoji')} />
            <ToolTile label="资料" icon="※" onPress={() => navigate({ name: 'learning', id })} />
          </SlidingToolPanel>
        ) : null}
      </ScreenFrame>
    </KeyboardAvoidingView>
  );
}

function ChatMenuScreen({
  id,
  navigate,
}: {
  id: string;
  navigate: (screen: ScreenState) => void;
}) {
  const { styles } = useAppTheme();
  const [profile, setProfile] = useState<ExProfileDetail | null>(null);
  const [status, setStatus] = useState('聊天设置只影响当前这个她。');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function load() {
    setProfile(await getExProfile(id));
  }

  useEffect(() => {
    load().catch((caught) => setStatus(caught instanceof Error ? caught.message : '读取菜单失败'));
  }, [id]);

  async function pickAvatar() {
    try {
      const picked = await pickImageSource('image');
      if (!picked) {
        setStatus('已取消选择头像。');
        return;
      }

      await updateExProfileMedia(id, { avatarUri: picked.localUri });
      await load();
      setStatus('头像已更新。');
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : '更新头像失败');
    }
  }

  async function pickBackground() {
    try {
      const picked = await pickImageSource('image');
      if (!picked) {
        setStatus('已取消选择背景。');
        return;
      }

      await updateExProfileMedia(id, { chatBackgroundUri: picked.localUri });
      await load();
      setStatus('聊天背景已更新。');
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : '更新背景失败');
    }
  }

  async function removeBackground() {
    await updateExProfileMedia(id, { chatBackgroundUri: null });
    await load();
    setStatus('聊天背景已恢复默认。');
  }

  async function confirmDelete() {
    try {
      await deleteExProfile(id);
      navigate({ name: 'home' });
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : '删除失败');
    }
  }

  return (
    <ScreenFrame onSwipeBack={() => navigate({ name: 'chat', id })}>
      <View style={styles.chatHeader}>
        <RoundButton label="‹" onPress={() => navigate({ name: 'chat', id })} />
        <View style={styles.chatTitleBox}>
          <Text style={styles.titleSmall}>聊天设置</Text>
          <Text style={styles.metaText}>{profile?.name ?? '她'}</Text>
        </View>
      </View>

      <View style={styles.profileSummary}>
        {profile ? <Avatar profile={profile} size={62} /> : null}
        <View style={styles.cardBody}>
          <Text style={styles.name}>{profile?.name ?? '她'}</Text>
          <Text style={styles.metaText}>关系温度 {profile?.temperature ?? 50} · {profile?.mood ?? '读取中'}</Text>
        </View>
      </View>

      <View style={styles.menuPageList}>
        <MenuRow title="搜索聊天记录" detail="进入聊天页后显示搜索框" onPress={() => navigate({ name: 'chat', id, search: true })} />
        <MenuRow title="学习资料" detail="导入资料、查看和细调 Skill 档案" onPress={() => navigate({ name: 'learning', id })} />
        <MenuRow title="更换头像" detail="不选头像时继续显示首字" onPress={pickAvatar} />
        <MenuRow title="自定义聊天背景" detail={profile?.chatBackgroundUri ? '已设置，可继续更换' : '从相册选择一张背景图'} onPress={pickBackground} />
        {profile?.chatBackgroundUri ? <MenuRow title="恢复默认背景" detail="移除当前聊天背景" onPress={removeBackground} /> : null}
        <MenuRow title="删除她" detail="删除角色、聊天记录和资料" danger onPress={() => setConfirmingDelete(true)} />
      </View>

      <Text style={styles.statusText}>{status}</Text>
      {confirmingDelete ? (
        <View style={styles.deleteBar}>
          <Text style={styles.deleteText}>确认删除「{profile?.name ?? '她'}」？聊天记录和学习资料也会一起删除。</Text>
          <View style={styles.deleteActions}>
            <PressableScale onPress={() => setConfirmingDelete(false)} style={styles.cancelDeleteButton}>
              <Text style={styles.deleteButtonText}>取消</Text>
            </PressableScale>
            <PressableScale onPress={confirmDelete} style={styles.confirmDeleteButton}>
              <Text style={styles.deleteButtonText}>删除</Text>
            </PressableScale>
          </View>
        </View>
      ) : null}
    </ScreenFrame>
  );
}

function LearningScreen({
  id,
  navigate,
}: {
  id: string;
  navigate: (screen: ScreenState) => void;
}) {
  const { colors, styles } = useAppTheme();
  const [profile, setProfile] = useState<ExProfileDetail | null>(null);
  const [sources, setSources] = useState<LearningSource[]>([]);
  const [manualText, setManualText] = useState('');
  const [skillDraft, setSkillDraft] = useState({
    persona: '',
    sharedMemories: '',
    speechStyle: '',
    triggers: '',
  });
  const [status, setStatus] = useState('资料会先保存在本机，学习时再发送必要片段给模型。');
  const [loading, setLoading] = useState(true);
  const [learning, setLearning] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const [nextProfile, nextSources] = await Promise.all([
        getExProfile(id),
        getLearningSources(id),
      ]);
      setProfile(nextProfile);
      setSources(nextSources);
      if (nextProfile) {
        setSkillDraft({
          persona: nextProfile.persona,
          sharedMemories: nextProfile.sharedMemories,
          speechStyle: nextProfile.speechStyle,
          triggers: nextProfile.triggers,
        });
      }
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : '读取学习资料失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function importDocument(type: LearningSourceType = 'document') {
    try {
      setStatus('正在选择文件...');
      const picked = await pickDocumentSource(type);
      if (!picked) {
        setStatus('已取消导入。');
        return;
      }

      await addLearningSource({
        exId: id,
        localUri: picked.localUri,
        summary: '等待学习分析。',
        title: picked.title,
        type: picked.type,
      });
      await load();
      setStatus('文件已加入学习资料。');
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : '导入失败');
    }
  }

  async function importImage(type: LearningSourceType) {
    try {
      setStatus('正在选择图片...');
      const picked = await pickImageSources(type, 9);
      if (!picked.length) {
        setStatus('已取消导入。');
        return;
      }

      await Promise.all(
        picked.map((item) =>
          addLearningSource({
            exId: id,
            localUri: item.localUri,
            summary: '已导入，生成 Skill 档案时会作为图片资料交给模型参考。',
            title: item.title,
            type: item.type,
          })
        )
      );
      await load();
      setStatus(`已导入 ${picked.length} 张图片。现在还没有单独分析，点击“生成 Skill 档案”后会统一整合。`);
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : '导入失败');
    }
  }

  async function addManualText() {
    const text = manualText.trim();
    if (!text) {
      setStatus('先写一点补充资料。');
      return;
    }

    await addLearningSource({
      exId: id,
      rawText: text,
      summary: text.slice(0, 80),
      title: `手动补充 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
      type: 'text',
    });
    setManualText('');
    await load();
    setStatus('手动资料已加入。');
  }

  async function startLearning() {
    if (!profile || learning) {
      return;
    }

    try {
      setLearning(true);
      setStatus('正在生成她的 Skill 档案...');
      const settings = await getApiSettings();
      const prompt = buildSkillProfilePrompt(profile, sources);
      const response = await generateStructuredText(settings, prompt);
      const draft = parseSkillProfileDraft(response);
      await updateSkillProfile(id, mergeSkillDraft(profile, draft));
      await markLearningSourcesLearned(id);
      await load();
      setStatus('Skill 档案已更新，会影响后续聊天语气。');
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : '学习失败');
    } finally {
      setLearning(false);
    }
  }

  async function saveSkillDraft() {
    if (!profile) {
      return;
    }

    await updateSkillProfile(id, mergeSkillDraft(profile, skillDraft));
    await load();
    setStatus('Skill 档案已手动保存。');
  }

  return (
    <ScreenFrame flushBottom onSwipeBack={() => navigate({ name: 'chat', id })}>
      <View style={styles.chatHeader}>
        <RoundButton label="‹" onPress={() => navigate({ name: 'chat', id })} />
        <View style={styles.chatTitleBox}>
          <Text style={styles.titleSmall}>学习资料</Text>
          <Text style={styles.metaText}>{profile?.name ?? '她'} 的 Skill 档案</Text>
        </View>
      </View>

      {loading ? <LoadingLine text="正在读取资料库..." /> : null}
      <ScrollView
        contentContainerStyle={styles.learningContent}
        showsVerticalScrollIndicator={false}
        style={styles.fillScroll}
      >
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>导入资料</Text>
          <Text style={styles.panelBody}>
            支持聊天记录、照片/截图、表情包和你的主观描述。原始资料保存在本机。
          </Text>
          <View style={styles.actionRow}>
            <PressableScale onPress={() => importDocument('document')} style={styles.secondaryAction}>
              <Text style={styles.primaryActionText}>聊天/文件</Text>
            </PressableScale>
            <PressableScale onPress={() => importImage('screenshot')} style={styles.secondaryAction}>
              <Text style={styles.primaryActionText}>照片/截图</Text>
            </PressableScale>
            <PressableScale onPress={() => importImage('sticker')} style={styles.secondaryAction}>
              <Text style={styles.primaryActionText}>表情包</Text>
            </PressableScale>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>手动补充</Text>
          <TextInput
            multiline
            onChangeText={setManualText}
            placeholder="补充她的性格、口头禅、雷点、你们之间发生过的事..."
            placeholderTextColor={colors.muted}
            style={[styles.fieldInput, styles.fieldInputMultiline]}
            value={manualText}
          />
          <PressableScale onPress={addManualText} style={styles.primaryAction}>
            <Text style={styles.primaryActionText}>加入资料</Text>
          </PressableScale>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>开始学习</Text>
          <Text style={styles.panelBody}>{status}</Text>
          <PressableScale disabled={learning} onPress={startLearning} style={styles.primaryAction}>
            <Text style={styles.primaryActionText}>{learning ? '学习中...' : '生成 Skill 档案'}</Text>
          </PressableScale>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Skill 档案</Text>
          <Text style={styles.panelBody}>这里可以查看和细调生成后的设定。保存时会与现有档案整合，不会因为某个字段为空就抹掉旧内容。</Text>
          <SkillField
            label="人格底色"
            onChangeText={(persona) => setSkillDraft((current) => ({ ...current, persona }))}
            value={skillDraft.persona}
          />
          <SkillField
            label="共同记忆"
            onChangeText={(sharedMemories) => setSkillDraft((current) => ({ ...current, sharedMemories }))}
            value={skillDraft.sharedMemories}
          />
          <SkillField
            label="说话习惯"
            onChangeText={(speechStyle) => setSkillDraft((current) => ({ ...current, speechStyle }))}
            value={skillDraft.speechStyle}
          />
          <SkillField
            label="雷点边界"
            onChangeText={(triggers) => setSkillDraft((current) => ({ ...current, triggers }))}
            value={skillDraft.triggers}
          />
          <PressableScale onPress={saveSkillDraft} style={styles.secondaryAction}>
            <Text style={styles.primaryActionText}>保存细调</Text>
          </PressableScale>
        </View>

        <Text style={styles.sectionLabel}>已导入资料</Text>
        {sources.length === 0 ? (
          <Text style={styles.emptyText}>还没有资料。先导入聊天记录、照片、表情包或手动描述。</Text>
        ) : null}
        {sources.map((source, index) => (
          <StaggeredItem key={source.id} index={index} compact>
            <View style={styles.importedCard}>
              <Text style={styles.importedTitle}>{source.title}</Text>
              <Text style={styles.importedMeta}>{source.type} · {source.status}</Text>
              <Text style={styles.importedBody}>{source.summary || source.rawText || '等待学习分析。'}</Text>
            </View>
          </StaggeredItem>
        ))}
      </ScrollView>
    </ScreenFrame>
  );
}

function SettingsScreen({ navigate }: { navigate: (screen: ScreenState) => void }) {
  const { mode, setMode, styles } = useAppTheme();
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
    <ScreenFrame onSwipeBack={() => navigate({ name: 'home' })}>
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

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>外观</Text>
        <View style={styles.segmented}>
          {([
            ['dark', '深色'],
            ['light', '浅色'],
            ['auto', '自动'],
          ] as const).map(([value, label]) => (
            <PressableScale
              key={value}
              onPress={() => setMode(value)}
              style={[styles.segmentButton, mode === value && styles.segmentButtonActive]}
            >
              <Text style={[styles.segmentText, mode === value && styles.segmentTextActive]}>{label}</Text>
            </PressableScale>
          ))}
        </View>
      </View>

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
  const { styles } = useAppTheme();
  const [name, setName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | undefined>();
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
        avatarUri,
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

  async function pickAvatarForNewProfile() {
    try {
      const picked = await pickImageSource('image');
      if (picked) {
        setAvatarUri(picked.localUri);
        setStatus('头像已选择。不选也没关系，会默认显示首字。');
      }
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : '选择头像失败');
    }
  }

  return (
    <ScreenFrame onSwipeBack={() => navigate({ name: 'home' })}>
      <View style={styles.chatHeader}>
        <RoundButton label="‹" onPress={() => navigate({ name: 'home' })} />
        <View>
          <Text style={styles.titleSmall}>添加她</Text>
          <Text style={styles.metaText}>创建一个新的角色档案</Text>
        </View>
      </View>

      <Field label="名字" onChangeText={setName} placeholder="比如：林雨" value={name} />
      <PressableScale onPress={pickAvatarForNewProfile} style={styles.secondaryAction}>
        <Text style={styles.primaryActionText}>{avatarUri ? '更换头像' : '选择头像'}</Text>
      </PressableScale>
      {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatarPreview} /> : null}
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
  flushBottom,
  onSwipeBack,
}: {
  children: React.ReactNode;
  compact?: boolean;
  flushBottom?: boolean;
  onSwipeBack?: () => void;
}) {
  const { styles } = useAppTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Boolean(onSwipeBack) &&
        gestureState.dx > 18 &&
        Math.abs(gestureState.dy) < 24,
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 76 && Math.abs(gestureState.dy) < 42) {
          Keyboard.dismiss();
          onSwipeBack?.();
        }
      },
    })
  ).current;

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
      {...(onSwipeBack ? panResponder.panHandlers : {})}
      style={[
        styles.screen,
        compact && styles.screenCompact,
        flushBottom && styles.screenFlushBottom,
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
  const { colors, styles } = useAppTheme();
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.fieldInput, props.multiline && styles.fieldInputMultiline]}
        {...props}
      />
    </View>
  );
}

function LoadingLine({ text }: { text: string }) {
  const { colors, styles } = useAppTheme();
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
      <ActivityIndicator color={colors.accent} size="small" />
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
  const { styles } = useAppTheme();
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

function displayMessageContent(message: ChatMessage) {
  return message.role === 'assistant' ? cleanupChatReply(message.content) : message.content;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const { styles } = useAppTheme();
  const pop = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const content = displayMessageContent(message);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(pop, {
        damping: 14,
        mass: 0.8,
        stiffness: 210,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, pop]);

  return (
    <Animated.View
      style={[
        styles.bubble,
        message.role === 'user' ? styles.userBubble : styles.assistantBubble,
        { opacity, transform: [{ scale: pop }] },
      ]}
    >
      {message.imageUris?.length ? (
        <View style={styles.messageImageGrid}>
          {message.imageUris.map((uri, index) => (
            <Image key={`${uri}-${index}`} source={{ uri }} style={styles.messageImage} />
          ))}
        </View>
      ) : null}
      {content ? <Text style={styles.bubbleText}>{content}</Text> : null}
      <Text style={styles.bubbleTime}>{message.time}</Text>
    </Animated.View>
  );
}

function Avatar({ profile, size }: { profile: Pick<ExProfile, 'avatar' | 'avatarUri'>; size: number }) {
  const { styles } = useAppTheme();
  const radius = Math.round(size * 0.44);

  if (profile.avatarUri) {
    return <Image source={{ uri: profile.avatarUri }} style={[styles.avatarImage, { borderRadius: radius, height: size, width: size }]} />;
  }

  return (
    <View style={[styles.avatar, { borderRadius: radius, height: size, width: size }]}>
      <Text style={styles.avatarText}>{profile.avatar}</Text>
    </View>
  );
}

function MenuRow({
  danger,
  detail,
  onPress,
  title,
}: {
  danger?: boolean;
  detail: string;
  onPress: () => void;
  title: string;
}) {
  const { styles } = useAppTheme();

  return (
    <PressableScale onPress={onPress} style={styles.menuPageRow}>
      <View style={styles.cardBody}>
        <Text style={[styles.menuPageTitle, danger && styles.dangerText]}>{title}</Text>
        <Text style={styles.metaText}>{detail}</Text>
      </View>
      <Text style={styles.menuArrow}>›</Text>
    </PressableScale>
  );
}

function ToolTile({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const { styles } = useAppTheme();

  return (
    <PressableScale onPress={onPress} style={styles.toolTile}>
      <Text style={styles.toolIcon}>{icon}</Text>
      <Text numberOfLines={1} style={styles.toolLabel}>{label}</Text>
    </PressableScale>
  );
}

function SlidingToolPanel({ children }: { children: React.ReactNode }) {
  const { styles } = useAppTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.toolPanel,
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

function SkillField({
  label,
  onChangeText,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}) {
  const { colors, styles } = useAppTheme();

  return (
    <View style={styles.skillField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        multiline
        onChangeText={onChangeText}
        placeholder="等待学习资料生成..."
        placeholderTextColor={colors.muted}
        style={[styles.fieldInput, styles.skillInput]}
        value={value}
      />
    </View>
  );
}

function mergeSkillDraft(
  profile: ExProfileDetail,
  draft: {
    persona: string;
    sharedMemories: string;
    speechStyle: string;
    triggers: string;
  }
) {
  return {
    persona: draft.persona.trim() || profile.persona,
    sharedMemories: draft.sharedMemories.trim() || profile.sharedMemories,
    speechStyle: draft.speechStyle.trim() || profile.speechStyle,
    triggers: draft.triggers.trim() || profile.triggers,
  };
}

function PressableScale({
  children,
  disabled,
  onLongPress,
  onPress,
  style,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onLongPress?: () => void;
  onPress: () => void;
  style?: React.ComponentProps<typeof Pressable>['style'];
}) {
  const { styles } = useAppTheme();
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
        onLongPress={onLongPress}
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

const createStyles = (palette: AppPalette) => StyleSheet.create({
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
    paddingBottom: 0,
  },
  screenFlushBottom: {
    paddingBottom: 0,
  },
  fillScroll: {
    flex: 1,
  },
  chatBackgroundImage: {
    bottom: 0,
    left: 0,
    opacity: 0.18,
    position: 'absolute',
    right: 0,
    top: 0,
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
  avatarImage: {
    backgroundColor: palette.avatar,
  },
  avatarPreview: {
    borderRadius: 18,
    height: 88,
    marginBottom: 14,
    width: 88,
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
  searchInput: {
    backgroundColor: palette.input,
    borderColor: palette.stroke,
    borderRadius: 16,
    borderWidth: 1,
    color: palette.text,
    fontSize: 14,
    minHeight: 40,
    marginBottom: 12,
    paddingHorizontal: 13,
  },
  moreMenu: {
    backgroundColor: palette.glassStrong,
    borderColor: palette.stroke,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
    padding: 10,
  },
  menuAction: {
    alignItems: 'center',
    backgroundColor: palette.input,
    borderColor: palette.stroke,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  menuActionText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '800',
  },
  messageList: {
    flex: 1,
  },
  messages: {
    flexGrow: 1,
    gap: 12,
    justifyContent: 'flex-end',
    paddingBottom: 18,
  },
  messagesWithBottomControls: {
    paddingBottom: 34,
  },
  emptySearchText: {
    alignSelf: 'center',
    color: palette.muted,
    fontSize: 13,
    paddingVertical: 24,
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
  composerIconButton: {
    alignItems: 'center',
    backgroundColor: palette.input,
    borderColor: palette.stroke,
    borderRadius: 16,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  composerIconText: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '800',
  },
  input: {
    color: palette.text,
    flex: 1,
    fontSize: 15,
    minHeight: 36,
  },
  selectedImageStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 8,
  },
  selectedImageItem: {
    position: 'relative',
  },
  selectedImageThumb: {
    borderRadius: 12,
    height: 54,
    width: 54,
  },
  selectedImageRemove: {
    backgroundColor: palette.backgroundAlt,
    borderRadius: 9,
    color: palette.text,
    fontSize: 12,
    fontWeight: '800',
    height: 18,
    lineHeight: 18,
    position: 'absolute',
    right: -5,
    textAlign: 'center',
    top: -5,
    width: 18,
  },
  toolPanel: {
    backgroundColor: palette.backgroundAlt,
    borderTopColor: palette.stroke,
    borderTopWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: -22,
    marginBottom: -36,
    marginTop: 10,
    paddingHorizontal: 22,
    paddingBottom: 40,
    paddingTop: 18,
  },
  emojiButton: {
    alignItems: 'center',
    backgroundColor: palette.input,
    borderRadius: 18,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  emojiText: {
    fontSize: 24,
  },
  toolTile: {
    alignItems: 'center',
    gap: 8,
    width: 64,
  },
  toolIcon: {
    backgroundColor: palette.input,
    borderRadius: 16,
    color: palette.text,
    fontSize: 24,
    height: 58,
    lineHeight: 58,
    overflow: 'hidden',
    textAlign: 'center',
    width: 58,
  },
  toolLabel: {
    color: palette.subtle,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    width: 64,
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
  skillField: {
    gap: 7,
  },
  skillInput: {
    minHeight: 82,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  learningContent: {
    gap: 14,
    paddingBottom: 96,
  },
  panel: {
    backgroundColor: palette.glassStrong,
    borderColor: palette.stroke,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  panelTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  panelBody: {
    color: palette.subtle,
    fontSize: 13,
    lineHeight: 20,
  },
  sectionLabel: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  emptyText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  importedCard: {
    backgroundColor: palette.glassStrong,
    borderColor: palette.stroke,
    borderRadius: 18,
    borderWidth: 1,
    gap: 5,
    padding: 14,
  },
  importedTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  importedMeta: {
    color: palette.accentSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  importedBody: {
    color: palette.subtle,
    fontSize: 13,
    lineHeight: 19,
  },
  profileSummary: {
    alignItems: 'center',
    backgroundColor: palette.glassStrong,
    borderColor: palette.stroke,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
    padding: 16,
  },
  menuPageList: {
    gap: 10,
    marginBottom: 16,
  },
  menuPageRow: {
    alignItems: 'center',
    backgroundColor: palette.glassStrong,
    borderColor: palette.stroke,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 64,
    padding: 14,
  },
  menuPageTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  menuArrow: {
    color: palette.muted,
    fontSize: 24,
    fontWeight: '700',
  },
  dangerText: {
    color: palette.accentSoft,
  },
  segmented: {
    backgroundColor: palette.input,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 6,
    padding: 5,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    minHeight: 36,
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: palette.accent,
  },
  segmentText: {
    color: palette.subtle,
    fontSize: 13,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: palette.text,
  },
  messageImageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  messageImage: {
    borderRadius: 12,
    height: 108,
    width: 108,
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
  deleteBar: {
    backgroundColor: palette.glassStrong,
    borderColor: palette.stroke,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  deleteText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  deleteActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelDeleteButton: {
    alignItems: 'center',
    backgroundColor: palette.input,
    borderColor: palette.stroke,
    borderRadius: 15,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  confirmDeleteButton: {
    alignItems: 'center',
    backgroundColor: palette.accent,
    borderRadius: 15,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  deleteButtonText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
  },
});

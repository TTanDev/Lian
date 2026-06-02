import { Link, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, FileText, Image, MessageSquareText, Sparkles, Sticker, Upload } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';

import { GlassCard } from '@/components/GlassCard';
import { Screen } from '@/components/Screen';
import { useExProfile } from '@/features/exes/hooks';
import {
  addLearningSource,
  getLearningSources,
  updateSkillProfile,
} from '@/features/exes/repository';
import { LearningSource, LearningSourceType } from '@/features/exes/types';
import { pickDocumentSource, pickImageSource } from '@/features/learning/importers';
import {
  buildSkillProfilePrompt,
  parseSkillProfileDraft,
} from '@/features/learning/skillProfile';
import { generateStructuredText } from '@/lib/openai/client';
import { getApiSettings } from '@/lib/settings/apiSettings';
import { palette } from '@/theme/palette';

const sourceTypes = [
  { icon: MessageSquareText, title: '聊天记录', body: '微信、iMessage、短信或粘贴文本。' },
  { icon: Image, title: '照片/截图', body: '共同场景、社媒截图、聊天截图。' },
  { icon: Sticker, title: '表情包', body: '学习她什么时候爱用哪些表情。' },
  { icon: FileText, title: '主观描述', body: '你补充她的性格、雷点和关系背景。' },
];

export default function LearningScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: ex, error, loading } = useExProfile(id);
  const [sources, setSources] = useState<LearningSource[]>([]);
  const [actionStatus, setActionStatus] = useState('资料会先保存在本机，之后再分批学习。');
  const [learning, setLearning] = useState(false);

  useEffect(() => {
    if (!id) {
      return;
    }

    loadSources(id);
  }, [id]);

  async function loadSources(exId: string) {
    const nextSources = await getLearningSources(exId);
    setSources(nextSources);
  }

  async function handlePickDocument(type: LearningSourceType = 'document') {
    if (!id) {
      return;
    }

    try {
      setActionStatus('正在选择文件...');
      const picked = await pickDocumentSource(type);
      if (!picked) {
        setActionStatus('已取消导入。');
        return;
      }
      await addLearningSource({
        exId: id,
        localUri: picked.localUri,
        summary: '等待学习分析。',
        title: picked.title,
        type: picked.type,
      });
      await loadSources(id);
      setActionStatus('文件已加入学习资料。');
    } catch (caught) {
      setActionStatus(caught instanceof Error ? caught.message : '导入失败');
    }
  }

  async function handlePickImage(type: LearningSourceType = 'image') {
    if (!id) {
      return;
    }

    try {
      setActionStatus('正在选择图片...');
      const picked = await pickImageSource(type);
      if (!picked) {
        setActionStatus('已取消导入。');
        return;
      }
      await addLearningSource({
        exId: id,
        localUri: picked.localUri,
        summary: '等待多模态模型分析。',
        title: picked.title,
        type: picked.type,
      });
      await loadSources(id);
      setActionStatus('图片已加入学习资料。');
    } catch (caught) {
      setActionStatus(caught instanceof Error ? caught.message : '导入失败');
    }
  }

  async function handleInitialLearning() {
    if (!id || !ex || learning) {
      return;
    }

    try {
      setLearning(true);
      setActionStatus('正在生成她的 Skill 档案...');
      const settings = await getApiSettings();
      const prompt = buildSkillProfilePrompt(ex, sources);
      const response = await generateStructuredText(settings, prompt);
      const draft = parseSkillProfileDraft(response);
      await updateSkillProfile(id, draft);
      setActionStatus('Skill 档案已更新，可以回角色详情查看。');
    } catch (caught) {
      setActionStatus(caught instanceof Error ? caught.message : '学习失败');
    } finally {
      setLearning(false);
    }
  }

  if (loading || !ex) {
    return (
      <Screen>
        <Text style={styles.stateText}>{error ?? '正在读取资料库...'}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Link href={`/ex/${ex.id}`} asChild>
          <Pressable style={styles.iconButton}>
            <ArrowLeft color={palette.text} size={21} />
          </Pressable>
        </Link>
        <View>
          <Text style={styles.title}>学习中心</Text>
          <Text style={styles.subtitle}>{ex.name} 的资料库</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GlassCard style={styles.hero}>
          <Sparkles color={palette.accent} size={24} />
          <Text style={styles.heroTitle}>把碎片资料变成她的 Skill 档案</Text>
          <Text style={styles.heroBody}>
            原始资料默认留在本地，学习时只分批发送必要片段和摘要给你配置的模型。
          </Text>
          <Pressable onPress={() => handlePickDocument('document')} style={styles.primaryAction}>
            <Upload color={palette.text} size={18} />
            <Text style={styles.primaryActionText}>添加文件</Text>
          </Pressable>
          <Pressable
            disabled={learning}
            onPress={handleInitialLearning}
            style={[styles.secondaryAction, learning && styles.actionDisabled]}
          >
            <Sparkles color={palette.text} size={18} />
            <Text style={styles.primaryActionText}>开始学习</Text>
          </Pressable>
          <Text style={styles.statusText}>{actionStatus}</Text>
        </GlassCard>

        {sourceTypes.map((source) => {
          const Icon = source.icon;
          return (
            <Pressable
              key={source.title}
              onPress={() => {
                if (source.title === '照片/截图') {
                  handlePickImage('screenshot');
                } else if (source.title === '表情包') {
                  handlePickImage('sticker');
                } else if (source.title === '聊天记录') {
                  handlePickDocument('document');
                } else {
                  handlePickDocument('text');
                }
              }}
            >
              <GlassCard style={styles.sourceCard}>
              <Icon color={palette.accentSoft} size={21} />
              <View style={styles.sourceText}>
                <Text style={styles.sourceTitle}>{source.title}</Text>
                <Text style={styles.sourceBody}>{source.body}</Text>
              </View>
              </GlassCard>
            </Pressable>
          );
        })}

        <Text style={styles.sectionLabel}>已导入资料</Text>
        {sources.length === 0 ? (
          <Text style={styles.emptyText}>还没有资料。先导入一点聊天记录、照片或表情包。</Text>
        ) : null}
        {sources.map((source) => (
          <GlassCard key={source.id} style={styles.importedCard}>
            <Text style={styles.importedTitle}>{source.title}</Text>
            <Text style={styles.importedMeta}>{source.type} · {source.status}</Text>
            <Text style={styles.importedBody}>{source.summary || '等待学习分析。'}</Text>
          </GlassCard>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    marginBottom: 18,
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
  title: {
    color: palette.text,
    fontSize: 25,
    fontWeight: '800',
  },
  subtitle: {
    color: palette.muted,
    fontSize: 13,
    marginTop: 3,
  },
  content: {
    gap: 14,
    paddingBottom: 28,
  },
  hero: {
    gap: 12,
  },
  heroTitle: {
    color: palette.text,
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 27,
  },
  heroBody: {
    color: palette.subtle,
    fontSize: 14,
    lineHeight: 21,
  },
  primaryAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: palette.accent,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 7,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: palette.input,
    borderColor: palette.stroke,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  primaryActionText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
  },
  statusText: {
    color: palette.subtle,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionLabel: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 6,
  },
  emptyText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 6,
  },
  importedCard: {
    gap: 5,
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
  sourceCard: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  sourceText: {
    flex: 1,
    gap: 4,
  },
  sourceTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  sourceBody: {
    color: palette.subtle,
    fontSize: 13,
    lineHeight: 19,
  },
});

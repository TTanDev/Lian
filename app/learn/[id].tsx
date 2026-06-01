import { Link, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, FileText, Image, MessageSquareText, Sparkles, Sticker, Upload } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { Screen } from '@/components/Screen';
import { useExProfile } from '@/features/exes/hooks';
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
          <Text style={styles.heroTitle}>把碎片资料变成前任 Skill 档案</Text>
          <Text style={styles.heroBody}>
            原始资料默认留在本地，学习时只分批发送必要片段和摘要给你配置的模型。
          </Text>
          <Pressable style={styles.primaryAction}>
            <Upload color={palette.text} size={18} />
            <Text style={styles.primaryActionText}>添加资料</Text>
          </Pressable>
        </GlassCard>

        {sourceTypes.map((source) => {
          const Icon = source.icon;
          return (
            <GlassCard key={source.title} style={styles.sourceCard}>
              <Icon color={palette.accentSoft} size={21} />
              <View style={styles.sourceText}>
                <Text style={styles.sourceTitle}>{source.title}</Text>
                <Text style={styles.sourceBody}>{source.body}</Text>
              </View>
            </GlassCard>
          );
        })}
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
  primaryActionText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
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

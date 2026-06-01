import { Link, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, BookOpen, Brain, HeartPulse, Pencil, Upload } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { Screen } from '@/components/Screen';
import { useExProfile } from '@/features/exes/hooks';
import { palette } from '@/theme/palette';

const sections = [
  { icon: Brain, title: 'Persona', body: '说话方式、口癖、撒娇和生气时的表达规则。' },
  { icon: BookOpen, title: '共同记忆', body: '重要事件、关系节点、地点、承诺和未解开的矛盾。' },
  { icon: HeartPulse, title: '情绪状态', body: '当前情绪半隐藏，聊天页只通过语气体现。' },
];

export default function ExDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: ex, error, loading } = useExProfile(id);

  if (loading || !ex) {
    return (
      <Screen>
        <Text style={styles.stateText}>{error ?? '正在读取角色...'}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Link href={`/chat/${ex.id}`} asChild>
          <Pressable style={styles.iconButton}>
            <ArrowLeft color={palette.text} size={21} />
          </Pressable>
        </Link>
        <Text style={styles.headerTitle}>角色详情</Text>
        <Pressable style={styles.iconButton}>
          <Pencil color={palette.text} size={19} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GlassCard style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{ex.avatar}</Text>
          </View>
          <Text style={styles.name}>{ex.name}</Text>
          <Text style={styles.description}>{ex.description}</Text>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{ex.temperature}</Text>
              <Text style={styles.statLabel}>关系温度</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{ex.mood}</Text>
              <Text style={styles.statLabel}>当前情绪</Text>
            </View>
          </View>
        </GlassCard>

        <Link href={`/learn/${ex.id}`} asChild>
          <Pressable>
            <GlassCard style={styles.learnCard}>
              <Upload color={palette.accent} size={22} />
              <View style={styles.learnText}>
                <Text style={styles.learnTitle}>继续添加资料</Text>
                <Text style={styles.learnBody}>聊天记录、照片、截图、表情包和你的主观描述都可以进入学习中心。</Text>
              </View>
            </GlassCard>
          </Pressable>
        </Link>

        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <GlassCard key={section.title} style={styles.sectionCard}>
              <Icon color={palette.accentSoft} size={20} />
              <View style={styles.sectionText}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionBody}>{section.body}</Text>
              </View>
            </GlassCard>
          );
        })}

        <GlassCard style={styles.sectionCard}>
          <Brain color={palette.accentSoft} size={20} />
          <View style={styles.sectionText}>
            <Text style={styles.sectionTitle}>当前 Skill 摘要</Text>
            <Text style={styles.sectionBody}>{ex.persona}</Text>
            <Text style={styles.sectionBody}>{ex.sharedMemories}</Text>
          </View>
        </GlassCard>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  headerTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  content: {
    gap: 14,
    paddingBottom: 28,
  },
  profileCard: {
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: palette.avatar,
    borderRadius: 34,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  avatarText: {
    color: palette.text,
    fontSize: 30,
    fontWeight: '800',
  },
  name: {
    color: palette.text,
    fontSize: 24,
    fontWeight: '800',
  },
  description: {
    color: palette.subtle,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  stats: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 8,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  statValue: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    color: palette.muted,
    fontSize: 12,
  },
  divider: {
    backgroundColor: palette.stroke,
    height: 32,
    width: 1,
  },
  learnCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  learnText: {
    flex: 1,
    gap: 4,
  },
  learnTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
  },
  learnBody: {
    color: palette.subtle,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionCard: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  sectionText: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  sectionBody: {
    color: palette.subtle,
    fontSize: 13,
    lineHeight: 19,
  },
});

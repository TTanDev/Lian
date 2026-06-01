import { Link } from 'expo-router';
import { ArrowLeft, Bell, Database, KeyRound, Server, ShieldCheck } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { Screen } from '@/components/Screen';
import { palette } from '@/theme/palette';

const settings = [
  { icon: Server, title: 'API Base URL', value: 'https://api.example.com/v1' },
  { icon: KeyRound, title: 'API Key', value: '保存在 iOS 安全存储中' },
  { icon: Database, title: '默认模型', value: 'mimo2.5' },
  { icon: Bell, title: '主动消息', value: '本地通知 · 中频率 · 23:30 后免打扰' },
  { icon: ShieldCheck, title: '隐私模式', value: '原始资料本地保存，学习时分批发送必要片段' },
];

export default function SettingsScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Link href="/" asChild>
          <Pressable style={styles.iconButton}>
            <ArrowLeft color={palette.text} size={21} />
          </Pressable>
        </Link>
        <Text style={styles.title}>设置</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GlassCard style={styles.formCard}>
          <Text style={styles.formTitle}>模型连接</Text>
          <TextInput
            placeholder="API Base URL"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value="https://api.example.com/v1"
          />
          <TextInput
            placeholder="API Key"
            placeholderTextColor={palette.muted}
            secureTextEntry
            style={styles.input}
            value="sk-••••••••••••"
          />
          <TextInput
            placeholder="Model"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value="mimo2.5"
          />
          <Pressable style={styles.testButton}>
            <Text style={styles.testButtonText}>测试连接</Text>
          </Pressable>
        </GlassCard>

        {settings.map((item) => {
          const Icon = item.icon;
          return (
            <GlassCard key={item.title} style={styles.settingCard}>
              <Icon color={palette.accentSoft} size={20} />
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>{item.title}</Text>
                <Text style={styles.settingValue}>{item.value}</Text>
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
  content: {
    gap: 14,
    paddingBottom: 28,
  },
  formCard: {
    gap: 12,
  },
  formTitle: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '800',
  },
  input: {
    backgroundColor: palette.input,
    borderColor: palette.stroke,
    borderRadius: 14,
    borderWidth: 1,
    color: palette.text,
    fontSize: 14,
    minHeight: 46,
    paddingHorizontal: 13,
  },
  testButton: {
    alignItems: 'center',
    backgroundColor: palette.accent,
    borderRadius: 16,
    paddingVertical: 12,
  },
  testButtonText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
  },
  settingCard: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  settingText: {
    flex: 1,
    gap: 4,
  },
  settingTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  settingValue: {
    color: palette.subtle,
    fontSize: 13,
    lineHeight: 19,
  },
});

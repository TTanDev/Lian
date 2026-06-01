import { Link } from 'expo-router';
import { ArrowLeft, Bell, Database, KeyRound, Server, ShieldCheck } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect, useState } from 'react';

import { GlassCard } from '@/components/GlassCard';
import { Screen } from '@/components/Screen';
import { testOpenAIConnection } from '@/lib/openai/client';
import { getApiSettings, saveApiSettings } from '@/lib/settings/apiSettings';
import { palette } from '@/theme/palette';

const settings = [
  { icon: Server, title: 'API Base URL', value: 'https://api.example.com/v1' },
  { icon: KeyRound, title: 'API Key', value: '保存在 iOS 安全存储中' },
  { icon: Database, title: '默认模型', value: 'mimo2.5' },
  { icon: Bell, title: '主动消息', value: '本地通知 · 中频率 · 23:30 后免打扰' },
  { icon: ShieldCheck, title: '隐私模式', value: '原始资料本地保存，学习时分批发送必要片段' },
];

export default function SettingsScreen() {
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('mimo2.5');
  const [status, setStatus] = useState('正在读取配置...');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const settings = await getApiSettings();
        if (!cancelled) {
          setBaseUrl(settings.baseUrl);
          setApiKey(settings.apiKey);
          setModel(settings.model);
          setStatus('配置只保存在本机。API Key 不会写进备份。');
        }
      } catch (caught) {
        if (!cancelled) {
          setStatus(caught instanceof Error ? caught.message : '读取配置失败');
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    try {
      setSaving(true);
      await saveApiSettings({ apiKey, baseUrl, model });
      setStatus('已保存配置。');
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    try {
      setSaving(true);
      setStatus('正在测试连接...');
      const normalized = { apiKey, baseUrl, model };
      await saveApiSettings(normalized);
      const reply = await testOpenAIConnection(normalized);
      setStatus(`连接成功：${reply}`);
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : '连接测试失败');
    } finally {
      setSaving(false);
    }
  }

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
            onChangeText={setBaseUrl}
            placeholder="API Base URL"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={baseUrl}
          />
          <TextInput
            onChangeText={setApiKey}
            placeholder="API Key"
            placeholderTextColor={palette.muted}
            secureTextEntry
            style={styles.input}
            value={apiKey}
          />
          <TextInput
            onChangeText={setModel}
            placeholder="Model"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={model}
          />
          <View style={styles.formActions}>
            <Pressable disabled={saving} onPress={handleSave} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>保存</Text>
            </Pressable>
            <Pressable disabled={saving} onPress={handleTest} style={styles.testButton}>
              <Text style={styles.testButtonText}>测试连接</Text>
            </Pressable>
          </View>
          <Text style={styles.statusText}>{status}</Text>
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
    flex: 1,
    paddingVertical: 12,
  },
  testButtonText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: palette.input,
    borderColor: palette.stroke,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
  },
  statusText: {
    color: palette.subtle,
    fontSize: 13,
    lineHeight: 19,
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

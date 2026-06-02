import { router } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { Screen } from '@/components/Screen';
import { createExProfile } from '@/features/exes/repository';
import { palette } from '@/theme/palette';
import { useState } from 'react';

export default function NewExScreen() {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [description, setDescription] = useState('');
  const [mood, setMood] = useState('还不确定');
  const [temperature, setTemperature] = useState('50');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = name.trim().length > 0 && description.trim().length > 0;

  async function handleSave() {
    if (!canSave || saving) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const profile = await createExProfile({
        avatar: avatar.trim().slice(0, 1) || name.trim().slice(0, 1) || '她',
        description: description.trim(),
        mood: mood.trim() || '还不确定',
        name: name.trim(),
        temperature: Number.parseInt(temperature, 10) || 50,
      });
      router.replace(`/chat/${profile.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <ArrowLeft color={palette.text} size={21} />
        </Pressable>
        <Text style={styles.title}>添加她</Text>
        <Pressable
          disabled={!canSave || saving}
          onPress={handleSave}
          style={[styles.saveButton, (!canSave || saving) && styles.saveButtonDisabled]}
        >
          <Check color={palette.text} size={20} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GlassCard style={styles.formCard}>
          <Text style={styles.label}>昵称</Text>
          <TextInput
            onChangeText={setName}
            placeholder="比如 林雨"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={name}
          />

          <Text style={styles.label}>头像字</Text>
          <TextInput
            maxLength={1}
            onChangeText={setAvatar}
            placeholder="默认取昵称第一个字"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={avatar}
          />

          <Text style={styles.label}>你对她的描述</Text>
          <TextInput
            multiline
            onChangeText={setDescription}
            placeholder="她的性格、你们的关系、她说话时的感觉..."
            placeholderTextColor={palette.muted}
            style={[styles.input, styles.textarea]}
            value={description}
          />

          <Text style={styles.label}>当前情绪</Text>
          <TextInput
            onChangeText={setMood}
            placeholder="比如 有点冷淡"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={mood}
          />

          <Text style={styles.label}>关系温度 0-100</Text>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setTemperature}
            placeholder="50"
            placeholderTextColor={palette.muted}
            style={styles.input}
            value={temperature}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </GlassCard>

        <Text style={styles.note}>
          创建后可以去学习中心继续添加聊天记录、照片、截图、表情包和主观描述。
        </Text>
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
  saveButton: {
    alignItems: 'center',
    backgroundColor: palette.accent,
    borderRadius: 17,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  saveButtonDisabled: {
    opacity: 0.45,
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
    gap: 10,
  },
  label: {
    color: palette.subtle,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  input: {
    backgroundColor: palette.input,
    borderColor: palette.stroke,
    borderRadius: 14,
    borderWidth: 1,
    color: palette.text,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 13,
  },
  textarea: {
    minHeight: 104,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  error: {
    color: palette.accentSoft,
    fontSize: 13,
    lineHeight: 19,
  },
  note: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 6,
  },
});

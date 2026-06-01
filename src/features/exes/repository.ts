import { Platform } from 'react-native';

import { getDatabase } from '@/lib/database/client';
import { formatListTime, formatMessageTime } from '@/lib/time/format';

import { ChatMessage, ExProfile, ExProfileDetail } from './types';
import { createWebExProfile, getWebExProfile, getWebExProfiles, getWebMessages } from './webFallback';

type ExProfileRow = {
  id: string;
  name: string;
  avatar: string;
  description: string;
  mood: string;
  temperature: number;
  persona: string;
  shared_memories: string;
  speech_style: string;
  triggers: string;
  last_message: string | null;
  last_message_at: number | null;
};

type MessageRow = {
  id: string;
  role: 'assistant' | 'user' | 'system' | 'imported';
  content: string;
  created_at: number;
  delay_note: string | null;
  sticker: string | null;
};

type CreateExProfileInput = {
  avatar: string;
  description: string;
  mood: string;
  name: string;
  temperature: number;
};

export async function getExProfiles(): Promise<ExProfile[]> {
  if (Platform.OS === 'web') {
    return getWebExProfiles();
  }

  const database = await getDatabase();
  const rows = await database.getAllAsync<ExProfileRow>(`
    SELECT
      ex_profiles.*,
      (
        SELECT content FROM messages
        WHERE messages.ex_id = ex_profiles.id
        ORDER BY created_at DESC
        LIMIT 1
      ) AS last_message,
      (
        SELECT created_at FROM messages
        WHERE messages.ex_id = ex_profiles.id
        ORDER BY created_at DESC
        LIMIT 1
      ) AS last_message_at
    FROM ex_profiles
    ORDER BY updated_at DESC
  `);

  return rows.map(mapExProfileRow);
}

export async function getExProfile(id: string): Promise<ExProfileDetail | null> {
  if (Platform.OS === 'web') {
    return getWebExProfile(id);
  }

  const database = await getDatabase();
  const row = await database.getFirstAsync<ExProfileRow>(
    `
      SELECT
        ex_profiles.*,
        (
          SELECT content FROM messages
          WHERE messages.ex_id = ex_profiles.id
          ORDER BY created_at DESC
          LIMIT 1
        ) AS last_message,
        (
          SELECT created_at FROM messages
          WHERE messages.ex_id = ex_profiles.id
          ORDER BY created_at DESC
          LIMIT 1
        ) AS last_message_at
      FROM ex_profiles
      WHERE id = ?
    `,
    id
  );

  return row ? mapExProfileDetailRow(row) : null;
}

export async function getMessages(exId: string): Promise<ChatMessage[]> {
  if (Platform.OS === 'web') {
    return getWebMessages(exId);
  }

  const database = await getDatabase();
  const rows = await database.getAllAsync<MessageRow>(
    `
      SELECT id, role, content, created_at, delay_note, sticker
      FROM messages
      WHERE ex_id = ?
      ORDER BY created_at ASC
    `,
    exId
  );

  return rows
    .filter(isVisibleChatMessage)
    .map((row) => ({
      content: row.content,
      delayNote: row.delay_note ?? undefined,
      id: row.id,
      role: row.role,
      sticker: row.sticker ?? undefined,
      time: formatMessageTime(row.created_at),
    }));
}

export async function createExProfile(input: CreateExProfileInput): Promise<ExProfileDetail> {
  if (Platform.OS === 'web') {
    return createWebExProfile(input);
  }

  const database = await getDatabase();
  const now = Date.now();
  const id = `ex-${now.toString(36)}`;
  const temperature = clampTemperature(input.temperature);

  await database.runAsync(
    `INSERT INTO ex_profiles
      (id, name, avatar, description, mood, temperature, persona, shared_memories, speech_style, triggers, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.avatar,
      input.description,
      input.mood,
      temperature,
      '还没有学习资料。先根据用户描述保持克制，不要过度编造。',
      '还没有共同记忆摘要。',
      '等待学习资料后生成说话习惯。',
      '等待学习资料后生成雷点和边界。',
      now,
      now
    ]
  );

  const profile = await getExProfile(id);
  if (!profile) {
    throw new Error('创建成功但读取角色失败');
  }

  return profile;
}

function isVisibleChatMessage(
  row: MessageRow
): row is MessageRow & { role: 'assistant' | 'user' } {
  return row.role === 'assistant' || row.role === 'user';
}

function mapExProfileRow(row: ExProfileRow): ExProfile {
  return {
    avatar: row.avatar,
    description: row.description,
    id: row.id,
    lastMessage: row.last_message ?? '还没有消息',
    lastMessageAt: formatListTime(row.last_message_at),
    mood: row.mood,
    name: row.name,
    temperature: row.temperature,
  };
}

function mapExProfileDetailRow(row: ExProfileRow): ExProfileDetail {
  return {
    ...mapExProfileRow(row),
    persona: row.persona,
    sharedMemories: row.shared_memories,
    speechStyle: row.speech_style,
    triggers: row.triggers,
  };
}

function clampTemperature(value: number) {
  if (Number.isNaN(value)) {
    return 50;
  }

  return Math.max(0, Math.min(100, value));
}

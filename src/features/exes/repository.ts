import { Platform } from 'react-native';

import { getDatabase } from '@/lib/database/client';
import { formatListTime, formatMessageTime } from '@/lib/time/format';

import {
  ChatMessage,
  ExProfile,
  ExProfileDetail,
  LearningSource,
  LearningSourceType,
  ProactiveMessage,
} from './types';
import {
  addWebAssistantMessage,
  addWebLearningSource,
  addWebUserMessage,
  createWebProactiveMessage,
  createWebExProfile,
  deleteWebExProfile,
  deliverWebProactiveMessage,
  getWebExProfile,
  getWebExProfiles,
  getWebLearningSources,
  getWebMessages,
  getWebScheduledProactiveMessages,
  setWebProactiveNotificationId,
  updateWebSkillProfile,
} from './webFallback';

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

type AddLearningSourceInput = {
  exId: string;
  type: LearningSourceType;
  title: string;
  localUri?: string;
  rawText?: string;
  summary?: string;
};

type LearningSourceRow = {
  id: string;
  ex_id: string;
  type: LearningSourceType;
  title: string;
  local_uri: string | null;
  raw_text: string | null;
  summary: string;
  status: 'pending' | 'learned' | 'failed';
  created_at: number;
};

type ProactiveMessageRow = {
  id: string;
  ex_id: string;
  content: string;
  scheduled_at: number;
  delivered_at: number | null;
  notification_id: string | null;
  status: 'scheduled' | 'delivered' | 'cancelled';
  created_at: number;
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

export async function deleteExProfile(id: string) {
  if (Platform.OS === 'web') {
    return deleteWebExProfile(id);
  }

  const database = await getDatabase();
  await database.runAsync('DELETE FROM ex_profiles WHERE id = ?', id);
}

export async function addUserMessage(exId: string, content: string): Promise<ChatMessage> {
  if (Platform.OS === 'web') {
    return addWebUserMessage(exId, content);
  }

  const database = await getDatabase();
  const now = Date.now();
  const id = `msg-${now.toString(36)}`;

  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT INTO messages (id, ex_id, role, content, created_at, source)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, exId, 'user', content, now, 'normal']
    );
    await database.runAsync(
      'UPDATE ex_profiles SET updated_at = ? WHERE id = ?',
      [now, exId]
    );
  });

  return {
    content,
    id,
    role: 'user',
    time: formatMessageTime(now),
  };
}

export async function addAssistantMessage(
  exId: string,
  content: string,
  options?: { delayNote?: string; sticker?: string }
): Promise<ChatMessage> {
  if (Platform.OS === 'web') {
    return addWebAssistantMessage(exId, content, options);
  }

  const database = await getDatabase();
  const now = Date.now();
  const id = `msg-${now.toString(36)}`;

  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT INTO messages (id, ex_id, role, content, created_at, source, delay_note, sticker)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, exId, 'assistant', content, now, 'normal', options?.delayNote ?? null, options?.sticker ?? null]
    );
    await database.runAsync(
      'UPDATE ex_profiles SET updated_at = ? WHERE id = ?',
      [now, exId]
    );
  });

  return {
    content,
    delayNote: options?.delayNote,
    id,
    role: 'assistant',
    sticker: options?.sticker,
    time: formatMessageTime(now),
  };
}

export async function getRecentMessagesForPrompt(exId: string, limit = 30) {
  if (Platform.OS === 'web') {
    return getWebMessages(exId).slice(-limit);
  }

  const database = await getDatabase();
  const rows = await database.getAllAsync<MessageRow>(
    `
      SELECT id, role, content, created_at, delay_note, sticker
      FROM messages
      WHERE ex_id = ? AND role IN ('assistant', 'user')
      ORDER BY created_at DESC
      LIMIT ?
    `,
    [exId, limit]
  );

  return rows
    .reverse()
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

export async function addLearningSource(input: AddLearningSourceInput): Promise<LearningSource> {
  if (Platform.OS === 'web') {
    return addWebLearningSource(input);
  }

  const database = await getDatabase();
  const now = Date.now();
  const id = `source-${now.toString(36)}`;

  await database.runAsync(
    `INSERT INTO learning_sources
      (id, ex_id, type, title, local_uri, raw_text, summary, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.exId,
      input.type,
      input.title,
      input.localUri ?? null,
      input.rawText ?? null,
      input.summary ?? '',
      'pending',
      now,
      now
    ]
  );

  return {
    createdAt: now,
    exId: input.exId,
    id,
    localUri: input.localUri,
    rawText: input.rawText,
    status: 'pending',
    summary: input.summary ?? '',
    title: input.title,
    type: input.type,
  };
}

export async function getLearningSources(exId: string): Promise<LearningSource[]> {
  if (Platform.OS === 'web') {
    return getWebLearningSources(exId);
  }

  const database = await getDatabase();
  const rows = await database.getAllAsync<LearningSourceRow>(
    `
      SELECT id, ex_id, type, title, local_uri, raw_text, summary, status, created_at
      FROM learning_sources
      WHERE ex_id = ?
      ORDER BY created_at DESC
    `,
    exId
  );

  return rows.map((row) => ({
    createdAt: row.created_at,
    exId: row.ex_id,
    id: row.id,
    localUri: row.local_uri ?? undefined,
    rawText: row.raw_text ?? undefined,
    status: row.status,
    summary: row.summary,
    title: row.title,
    type: row.type,
  }));
}

export async function updateSkillProfile(
  exId: string,
  draft: {
    persona: string;
    sharedMemories: string;
    speechStyle: string;
    triggers: string;
  }
) {
  if (Platform.OS === 'web') {
    return updateWebSkillProfile(exId, draft);
  }

  const database = await getDatabase();
  const now = Date.now();

  await database.runAsync(
    `
      UPDATE ex_profiles
      SET persona = ?, shared_memories = ?, speech_style = ?, triggers = ?, updated_at = ?
      WHERE id = ?
    `,
    [draft.persona, draft.sharedMemories, draft.speechStyle, draft.triggers, now, exId]
  );
}

export async function createProactiveMessage(
  exId: string,
  content: string,
  scheduledAt: number
): Promise<ProactiveMessage> {
  if (Platform.OS === 'web') {
    return createWebProactiveMessage(exId, content, scheduledAt);
  }

  const database = await getDatabase();
  const now = Date.now();
  const id = `proactive-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  await database.runAsync(
    `INSERT INTO proactive_messages
      (id, ex_id, content, scheduled_at, delivered_at, notification_id, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, exId, content, scheduledAt, null, null, 'scheduled', now]
  );

  return {
    content,
    createdAt: now,
    exId,
    id,
    scheduledAt,
    status: 'scheduled',
  };
}

export async function setProactiveNotificationId(proactiveMessageId: string, notificationId: string) {
  if (Platform.OS === 'web') {
    return setWebProactiveNotificationId(proactiveMessageId, notificationId);
  }

  const database = await getDatabase();
  await database.runAsync(
    'UPDATE proactive_messages SET notification_id = ? WHERE id = ?',
    [notificationId, proactiveMessageId]
  );
}

export async function getScheduledProactiveMessages(exId: string): Promise<ProactiveMessage[]> {
  if (Platform.OS === 'web') {
    return getWebScheduledProactiveMessages(exId);
  }

  const database = await getDatabase();
  const rows = await database.getAllAsync<ProactiveMessageRow>(
    `
      SELECT id, ex_id, content, scheduled_at, delivered_at, notification_id, status, created_at
      FROM proactive_messages
      WHERE ex_id = ? AND status = 'scheduled' AND scheduled_at > ?
      ORDER BY scheduled_at ASC
    `,
    [exId, Date.now()]
  );

  return rows.map(mapProactiveMessageRow);
}

export async function deliverProactiveMessage(proactiveMessageId: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return deliverWebProactiveMessage(proactiveMessageId);
  }

  const database = await getDatabase();
  const row = await database.getFirstAsync<ProactiveMessageRow>(
    `
      SELECT id, ex_id, content, scheduled_at, delivered_at, notification_id, status, created_at
      FROM proactive_messages
      WHERE id = ?
    `,
    proactiveMessageId
  );

  if (!row || row.status !== 'scheduled') {
    return row?.ex_id ?? null;
  }

  const now = Date.now();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT INTO messages (id, ex_id, role, content, created_at, source)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [`msg-${now.toString(36)}`, row.ex_id, 'assistant', row.content, now, 'proactive']
    );
    await database.runAsync(
      `UPDATE proactive_messages
       SET status = 'delivered', delivered_at = ?
       WHERE id = ?`,
      [now, row.id]
    );
    await database.runAsync(
      'UPDATE ex_profiles SET updated_at = ? WHERE id = ?',
      [now, row.ex_id]
    );
  });

  return row.ex_id;
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

function mapProactiveMessageRow(row: ProactiveMessageRow): ProactiveMessage {
  return {
    content: row.content,
    createdAt: row.created_at,
    deliveredAt: row.delivered_at ?? undefined,
    exId: row.ex_id,
    id: row.id,
    notificationId: row.notification_id ?? undefined,
    scheduledAt: row.scheduled_at,
    status: row.status,
  };
}

function clampTemperature(value: number) {
  if (Number.isNaN(value)) {
    return 50;
  }

  return Math.max(0, Math.min(100, value));
}

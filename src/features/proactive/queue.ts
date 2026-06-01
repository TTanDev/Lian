import {
  addAssistantMessage,
  createProactiveMessage,
  getRecentMessagesForPrompt,
  getScheduledProactiveMessages,
  setProactiveNotificationId,
} from '@/features/exes/repository';
import { ExProfileDetail } from '@/features/exes/types';
import { generateChatReply } from '@/lib/openai/client';
import { getApiSettings } from '@/lib/settings/apiSettings';

import { ensureNotificationPermissions, scheduleProactiveNotification } from './notifications';
import { buildProactivePrompt } from './prompt';

export async function letHerSaySomethingNow(profile: ExProfileDetail) {
  const content = await buildProactiveContent(profile);
  await addAssistantMessage(profile.id, content, {
    delayNote: '她主动发来的消息',
  });
  return content;
}

export async function scheduleUpcomingProactiveMessages(profile: ExProfileDetail) {
  const allowed = await ensureNotificationPermissions();
  if (!allowed) {
    throw new Error('需要允许本地通知，才能安排她主动发消息。');
  }

  const existing = await getScheduledProactiveMessages(profile.id);
  if (existing.length >= 3) {
    return existing.length;
  }

  const dates = pickUpcomingDates(3 - existing.length);

  for (const scheduledAt of dates) {
    const content = await buildScheduledProactiveContent(profile, scheduledAt);
    const message = await createProactiveMessage(profile.id, content, scheduledAt);
    const notificationId = await scheduleProactiveNotification(message, profile.name);
    await setProactiveNotificationId(message.id, notificationId);
  }

  return existing.length + dates.length;
}

async function buildScheduledProactiveContent(profile: ExProfileDetail, scheduledAt: number) {
  const recentMessages = await getRecentMessagesForPrompt(profile.id, 20);
  const modelGenerated = await tryBuildModelProactiveContent(profile, recentMessages, scheduledAt);
  if (modelGenerated) {
    return modelGenerated;
  }

  return buildFallbackProactiveContent(profile, recentMessages);
}

async function buildProactiveContent(profile: ExProfileDetail) {
  const recentMessages = await getRecentMessagesForPrompt(profile.id, 20);
  const modelGenerated = await tryBuildModelProactiveContent(profile, recentMessages);
  if (modelGenerated) {
    return modelGenerated;
  }

  return buildFallbackProactiveContent(profile, recentMessages);
}

async function tryBuildModelProactiveContent(
  profile: ExProfileDetail,
  recentMessages: Awaited<ReturnType<typeof getRecentMessagesForPrompt>>,
  scheduledAt?: number
) {
  try {
    const settings = await getApiSettings();
    const prompt = buildProactivePrompt(profile, recentMessages, { scheduledAt });
    const reply = await generateChatReply(settings, prompt);
    return cleanupProactiveReply(reply);
  } catch {
    return null;
  }
}

function buildFallbackProactiveContent(
  profile: ExProfileDetail,
  recentMessages: Awaited<ReturnType<typeof getRecentMessagesForPrompt>>
) {
  const lastMessage = recentMessages.at(-1);
  const isWaitingForUser = lastMessage?.role === 'assistant';

  if (isWaitingForUser && profile.temperature < 55) {
    return '你是不是又准备装作没看见我。';
  }

  if (isWaitingForUser) {
    return '你忙完了吗。';
  }

  if (profile.mood.includes('冷')) {
    return '刚刚突然想到你了，但又觉得算了。';
  }

  if (profile.temperature >= 65) {
    return '你现在在干嘛呀。';
  }

  return '你今天好像很安静。';
}

function cleanupProactiveReply(reply: string) {
  const cleaned = reply
    .trim()
    .replace(/^["“”]+|["“”]+$/g, '')
    .replace(/\n+/g, ' ');

  if (!cleaned) {
    return null;
  }

  return cleaned.length > 120 ? `${cleaned.slice(0, 118)}...` : cleaned;
}

function pickUpcomingDates(count: number) {
  const now = Date.now();
  const offsets = [60, 240, 26 * 60].slice(0, count);

  return offsets.map((minutes) => avoidQuietHours(now + minutes * 60 * 1000));
}

function avoidQuietHours(timestamp: number) {
  const date = new Date(timestamp);
  const hour = date.getHours();

  if (hour >= 23) {
    date.setDate(date.getDate() + 1);
    date.setHours(9, 30, 0, 0);
    return date.getTime();
  }

  if (hour < 9) {
    date.setHours(9, 30, 0, 0);
    return date.getTime();
  }

  return timestamp;
}

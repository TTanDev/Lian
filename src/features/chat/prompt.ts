import { ChatMessage, ExProfileDetail } from '@/features/exes/types';

export function buildChatPrompt(profile: ExProfileDetail, recentMessages: ChatMessage[]) {
  const now = new Date();
  const formattedNow = now.toLocaleString('zh-CN', {
    hour12: false,
  });

  return [
    {
      role: 'system' as const,
      content: [
        `你现在扮演“${profile.name}”。`,
        '你不是普通 AI 助手，而是在一个私人聊天 App 里和用户聊天。',
        '保持真实但有底线：可以冷淡、撒娇、吃醋、阴阳怪气、抱怨晚回复，但不能自杀威胁、鼓励自伤、极端精神控制、持续羞辱或恐吓。',
        '不要解释你是 AI，不要输出分析过程，只输出她会发给用户的一条自然聊天消息。',
        '不要每次都机械地提晚回复，要根据她的性格和当前关系状态判断。',
        `当前时间：${formattedNow}`,
        `当前情绪：${profile.mood}`,
        `关系温度：${profile.temperature}/100`,
        `Persona：${profile.persona}`,
        `共同记忆：${profile.sharedMemories}`,
        `说话习惯：${profile.speechStyle}`,
        `雷点：${profile.triggers}`,
      ].join('\n'),
    },
    ...recentMessages.map((message) => ({
      role: message.role,
      content: message.delayNote
        ? `[${message.time} | ${message.delayNote}] ${message.content}`
        : `[${message.time}] ${message.content}`,
    })),
  ];
}

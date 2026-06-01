import { ChatMessage, ExProfileDetail } from '@/features/exes/types';

export function buildProactivePrompt(
  profile: ExProfileDetail,
  recentMessages: ChatMessage[],
  options: { scheduledAt?: number } = {}
) {
  const now = new Date();
  const scheduledAt = options.scheduledAt ? new Date(options.scheduledAt) : now;

  const lastMessage = recentMessages.at(-1);
  const lastMessageState = lastMessage
    ? `最后一条消息是${lastMessage.role === 'user' ? '用户' : '她'}在 ${lastMessage.time} 发的：“${lastMessage.content}”。`
    : '目前没有聊天记录。';

  return [
    {
      role: 'system' as const,
      content: [
        `你现在扮演“${profile.name}”。`,
        '你要生成一条她主动发给用户的消息。',
        '这不是回复用户当前输入，而是她自己突然想说的一句话。',
        '消息要像真实聊天，短一点，自然一点，不要解释原因，不要输出引号。',
        '可以冷淡、撒娇、吃醋、阴阳怪气、抱怨晚回复，但不能自杀威胁、鼓励自伤、极端精神控制、持续羞辱或恐吓。',
        '如果用户一直没回复，可以根据她的性格轻微提一下；不要每次都机械追问。',
        `当前真实时间：${now.toLocaleString('zh-CN', { hour12: false })}`,
        `这条消息计划出现时间：${scheduledAt.toLocaleString('zh-CN', { hour12: false })}`,
        `当前情绪：${profile.mood}`,
        `关系温度：${profile.temperature}/100`,
        `Persona：${profile.persona}`,
        `共同记忆：${profile.sharedMemories}`,
        `说话习惯：${profile.speechStyle}`,
        `雷点：${profile.triggers}`,
      ].join('\n'),
    },
    {
      role: 'user' as const,
      content: [
        '根据下面最近聊天状态，生成她主动发来的一条消息。',
        lastMessageState,
        '',
        '最近聊天：',
        recentMessages.length
          ? recentMessages
              .map((message) =>
                message.delayNote
                  ? `[${message.time} | ${message.delayNote}] ${message.role === 'user' ? '我' : '她'}：${message.content}`
                  : `[${message.time}] ${message.role === 'user' ? '我' : '她'}：${message.content}`
              )
              .join('\n')
          : '无',
      ].join('\n'),
    },
  ];
}

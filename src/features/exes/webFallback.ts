import { ChatMessage, ExProfileDetail } from './types';

const webExProfiles: ExProfileDetail[] = [
  {
    id: 'rain',
    avatar: '林',
    description: '会嘴硬，但很在意回复速度。生气时会先冷下来，再用很短的话试探。',
    lastMessage: '你现在才回我啊？',
    lastMessageAt: '23:46',
    mood: '有点委屈',
    name: '林雨',
    persona: '嘴硬、敏感、在意被忽略。她不会每次都发脾气，但会记住对方是不是用心。',
    sharedMemories: '你们曾经因为回复太慢吵过几次，她表面说没事，其实会在意。',
    speechStyle: '短句偏多，偶尔阴阳怪气。委屈时会说“算了”。',
    temperature: 62,
    triggers: '长时间不回复、敷衍解释、临睡前突然消失。',
  },
  {
    id: 'moon',
    avatar: '月',
    description: '平时温柔，吵架时会沉默。喜欢用表情包缓和气氛。',
    lastMessage: '算了，你忙吧。',
    lastMessageAt: '昨天',
    mood: '冷淡',
    name: '许月',
    persona: '温柔但会回避冲突，不喜欢把话说太重。',
    sharedMemories: '你们常用表情包缓和尴尬，很多话不会直接讲破。',
    speechStyle: '语气轻，常用省略号。生气时会变得很客气。',
    temperature: 48,
    triggers: '逼问、反复解释、在她冷静时继续追问。',
  },
];

const webMessages: Record<string, ChatMessage[]> = {
  rain: [
    {
      content: '你在干嘛',
      id: 'rain-m1',
      role: 'assistant',
      time: '20:11',
    },
    {
      content: '刚忙完，今天事情有点多',
      id: 'rain-m2',
      role: 'user',
      time: '23:45',
    },
    {
      content: '三小时三十四分钟。你是真的忙，还是现在连回我都要排队了？',
      delayNote: '你 3 小时 34 分钟后回复',
      id: 'rain-m3',
      role: 'assistant',
      sticker: '🙂',
      time: '23:46',
    },
  ],
  moon: [
    {
      content: '算了，你忙吧。',
      id: 'moon-m1',
      role: 'assistant',
      time: '昨天',
    },
  ],
};

export function getWebExProfiles() {
  return webExProfiles.map(({ persona, sharedMemories, speechStyle, triggers, ...profile }) => profile);
}

export function getWebExProfile(id: string) {
  return webExProfiles.find((profile) => profile.id === id) ?? null;
}

export function getWebMessages(exId: string) {
  return webMessages[exId] ?? [];
}

export function createWebExProfile(input: {
  avatar: string;
  description: string;
  mood: string;
  name: string;
  temperature: number;
}) {
  const id = `web-${Date.now().toString(36)}`;
  const profile: ExProfileDetail = {
    id,
    avatar: input.avatar,
    description: input.description,
    lastMessage: '还没有消息',
    lastMessageAt: '',
    mood: input.mood,
    name: input.name,
    persona: '还没有学习资料。先根据用户描述保持克制，不要过度编造。',
    sharedMemories: '还没有共同记忆摘要。',
    speechStyle: '等待学习资料后生成说话习惯。',
    temperature: Math.max(0, Math.min(100, input.temperature)),
    triggers: '等待学习资料后生成雷点和边界。',
  };

  webExProfiles.unshift(profile);
  webMessages[id] = [];

  return profile;
}

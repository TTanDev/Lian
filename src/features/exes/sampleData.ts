import { ChatMessage, ExProfile } from './types';

export const sampleExes: ExProfile[] = [
  {
    id: 'rain',
    avatar: '林',
    description: '会嘴硬，但很在意回复速度。生气时会先冷下来，再用很短的话试探。',
    lastMessage: '你现在才回我啊？',
    lastMessageAt: '23:46',
    mood: '有点委屈',
    name: '林雨',
    temperature: 62,
  },
  {
    id: 'moon',
    avatar: '月',
    description: '平时温柔，吵架时会沉默。喜欢用表情包缓和气氛。',
    lastMessage: '算了，你忙吧。',
    lastMessageAt: '昨天',
    mood: '冷淡',
    name: '许月',
    temperature: 48,
  },
];

export const sampleMessages: ChatMessage[] = [
  {
    content: '你在干嘛',
    id: 'm1',
    role: 'assistant',
    time: '20:11',
  },
  {
    content: '刚忙完，今天事情有点多',
    id: 'm2',
    role: 'user',
    time: '23:45',
  },
  {
    content: '三小时三十四分钟。你是真的忙，还是现在连回我都要排队了？',
    delayNote: '你 3 小时 34 分钟后回复',
    id: 'm3',
    role: 'assistant',
    sticker: '🙂',
    time: '23:46',
  },
];

export function findExById(id: string | undefined): ExProfile {
  return sampleExes.find((ex) => ex.id === id) ?? sampleExes[0];
}

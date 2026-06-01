export type ExProfile = {
  id: string;
  avatar: string;
  description: string;
  lastMessage: string;
  lastMessageAt: string;
  mood: string;
  name: string;
  temperature: number;
};

export type ExProfileDetail = ExProfile & {
  persona: string;
  sharedMemories: string;
  speechStyle: string;
  triggers: string;
};

export type ChatMessage = {
  id: string;
  content: string;
  delayNote?: string;
  role: 'assistant' | 'user';
  sticker?: string;
  time: string;
};

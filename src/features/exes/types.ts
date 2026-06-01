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

export type ChatMessage = {
  id: string;
  content: string;
  delayNote?: string;
  role: 'assistant' | 'user';
  sticker?: string;
  time: string;
};

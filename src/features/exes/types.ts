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

export type LearningSourceType = 'text' | 'document' | 'image' | 'screenshot' | 'sticker' | 'social';

export type LearningSource = {
  id: string;
  exId: string;
  type: LearningSourceType;
  title: string;
  localUri?: string;
  rawText?: string;
  summary: string;
  status: 'pending' | 'learned' | 'failed';
  createdAt: number;
};

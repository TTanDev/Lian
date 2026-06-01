import { ApiSettings } from '@/lib/settings/apiSettings';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

export async function testOpenAIConnection(settings: ApiSettings): Promise<string> {
  validateSettings(settings);

  const response = await createChatCompletion(settings, [
    {
      role: 'system',
      content: '你只需要回复 OK，用来测试 API 连接。',
    },
    {
      role: 'user',
      content: 'ping',
    },
  ]);

  return response || 'OK';
}

export async function generateChatReply(settings: ApiSettings, messages: ChatMessage[]) {
  validateSettings(settings);
  return createChatCompletion(settings, messages);
}

async function createChatCompletion(settings: ApiSettings, messages: ChatMessage[]) {
  const response = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    body: JSON.stringify({
      messages,
      model: settings.model,
      temperature: 0.2,
    }),
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const text = await response.text();
  let payload: ChatCompletionResponse;

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`API 返回的不是 JSON：${text.slice(0, 80)}`);
  }

  if (!response.ok) {
    throw new Error(payload.error?.message || `API 请求失败：HTTP ${response.status}`);
  }

  return payload.choices?.[0]?.message?.content?.trim() ?? '';
}

function validateSettings(settings: ApiSettings) {
  if (!settings.baseUrl.trim()) {
    throw new Error('请先填写 API Base URL');
  }

  if (!settings.apiKey.trim()) {
    throw new Error('请先填写 API Key');
  }

  if (!settings.model.trim()) {
    throw new Error('请先填写模型名');
  }
}

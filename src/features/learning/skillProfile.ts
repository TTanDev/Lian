import { ExProfileDetail, LearningSource } from '@/features/exes/types';

export type SkillProfileDraft = {
  persona: string;
  sharedMemories: string;
  speechStyle: string;
  triggers: string;
};

export function buildSkillProfilePrompt(profile: ExProfileDetail, sources: LearningSource[]) {
  const sourceSummary = sources.length
    ? sources
        .map((source, index) => {
          const content = source.rawText || source.summary || source.title;
          return `${index + 1}. [${source.type}] ${source.title}\n${content}`;
        })
        .join('\n\n')
    : '暂无导入资料，只能根据用户创建角色时的描述生成非常保守的初稿。';

  return [
    {
      role: 'system' as const,
      content: [
        '你负责把用户提供的资料整理成一个“她的 Skill 档案”。',
        '请只输出 JSON，不要 markdown，不要解释。',
        'JSON 字段必须是 persona、sharedMemories、speechStyle、triggers。',
        '如果资料不足，要明确写“资料不足，暂时只能推测”，不要编造具体经历。',
        '安全边界：不能加入自杀威胁、鼓励自伤、极端精神控制、持续羞辱或恐吓用户的规则。',
      ].join('\n'),
    },
    {
      role: 'user' as const,
      content: [
        `昵称：${profile.name}`,
        `当前描述：${profile.description}`,
        `当前情绪：${profile.mood}`,
        `关系温度：${profile.temperature}/100`,
        '',
        '导入资料：',
        sourceSummary,
      ].join('\n'),
    },
  ];
}

export function parseSkillProfileDraft(text: string): SkillProfileDraft {
  const jsonText = extractJsonObject(text);
  const parsed = JSON.parse(jsonText) as Partial<SkillProfileDraft>;

  return {
    persona: normalizeField(parsed.persona, '资料不足，暂时只能生成保守 Persona。'),
    sharedMemories: normalizeField(parsed.sharedMemories, '资料不足，暂时没有可靠共同记忆。'),
    speechStyle: normalizeField(parsed.speechStyle, '资料不足，暂时没有可靠说话习惯。'),
    triggers: normalizeField(parsed.triggers, '资料不足，暂时没有可靠雷点。'),
  };
}

function extractJsonObject(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('模型没有返回有效 JSON');
  }

  return text.slice(start, end + 1);
}

function normalizeField(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

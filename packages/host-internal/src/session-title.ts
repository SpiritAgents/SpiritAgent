import {
  USE_SAME_LANGUAGE_AS_USER_MESSAGE_RULE,
  type JsonObject,
} from '@spiritagent/agent-core';

export const SESSION_TITLE_MAX_LENGTH = 40;

export const SESSION_TITLE_JSON_SCHEMA: JsonObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: {
      type: 'string',
      minLength: 1,
      maxLength: SESSION_TITLE_MAX_LENGTH,
    },
  },
  required: ['title'],
};

export function buildSessionTitlePrompt(firstUserMessage: string): string {
  const message = firstUserMessage.trim() || '(empty)';
  return [
    'Generate a short conversation title for the user message below.',
    'Return JSON only: {"title":"..."}. No Markdown, no explanations, no extra keys.',
    'Rules:',
    `- ${USE_SAME_LANGUAGE_AS_USER_MESSAGE_RULE}`,
    '- Keep it concise (ideally under 12 words).',
    '- No surrounding quotes, hashtags, or trailing punctuation.',
  ].join('\n')
    + '\n\n[user message]\n'
    + message;
}

export function normalizeGeneratedSessionTitle(raw: string, fallback: string): string {
  const collapsed = raw.trim().replace(/\s+/g, ' ');
  if (!collapsed) {
    return fallback;
  }

  const withoutQuotes = collapsed.replace(/^["'「『]+|["'」』]+$/g, '').trim();
  if (!withoutQuotes) {
    return fallback;
  }

  if (withoutQuotes.length <= SESSION_TITLE_MAX_LENGTH) {
    return withoutQuotes;
  }

  return `${withoutQuotes.slice(0, SESSION_TITLE_MAX_LENGTH)}…`;
}

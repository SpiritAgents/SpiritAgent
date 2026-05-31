import type { JsonValue } from '../ports.js';
import { cloneJsonValue } from '../tool-agent.js';

/**
 * Moonshot AI 视频输入兼容：AI SDK 的 OpenAI-compatible 适配层不会把 `video_url` 传给上游。
 * 在发起 chat.completions 前暂存已解析的 OpenAI 形态 messages（含 `ms://` 视频引用），
 * 由 Moonshot 专用 fetch 包装器在真正 HTTP 请求发出时写回 `messages` 字段。
 */
let pendingMoonshotChatCompletionMessages: JsonValue[] | undefined;

export function stashMoonshotChatCompletionMessages(messages: readonly JsonValue[]): void {
  pendingMoonshotChatCompletionMessages = messages.map((message) => cloneJsonValue(message));
}

export function peekMoonshotChatCompletionMessages(): JsonValue[] | undefined {
  return pendingMoonshotChatCompletionMessages;
}

export function takeMoonshotChatCompletionMessages(): JsonValue[] | undefined {
  const messages = pendingMoonshotChatCompletionMessages;
  pendingMoonshotChatCompletionMessages = undefined;
  return messages;
}

export function clearMoonshotChatCompletionMessages(): void {
  pendingMoonshotChatCompletionMessages = undefined;
}

export function openAiMessagesContainVideoUrl(messages: readonly JsonValue[]): boolean {
  for (const message of messages) {
    if (typeof message !== 'object' || message === null || Array.isArray(message)) {
      continue;
    }

    const record = message as Record<string, JsonValue>;
    if (record.role !== 'user' || !Array.isArray(record.content)) {
      continue;
    }

    for (const part of record.content) {
      if (typeof part === 'object' && part !== null && !Array.isArray(part)) {
        const partRecord = part as Record<string, JsonValue>;
        if (partRecord.type === 'video_url') {
          return true;
        }
      }
    }
  }

  return false;
}

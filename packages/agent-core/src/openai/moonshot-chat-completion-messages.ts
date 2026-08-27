import type { JsonValue } from "../ports.js";
import { cloneJsonValue } from "../tool-agent.js";

/**
 * OpenAI-compatible video_url compatibility: the AI SDK adapter does not pass `video_url` upstream.
 * Before issuing chat.completions, stash the resolved OpenAI-form messages (including inlined data URLs);
 * Xiaomi/DeepInfra fetch wrappers write the `messages` field back when the actual HTTP request is sent.
 * The official Moonshot provider converts video to native AI SDK file parts instead of using this stash.
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
    if (typeof message !== "object" || message === null || Array.isArray(message)) {
      continue;
    }

    const record = message as Record<string, JsonValue>;
    if (record.role !== "user" || !Array.isArray(record.content)) {
      continue;
    }

    for (const part of record.content) {
      if (typeof part === "object" && part !== null && !Array.isArray(part)) {
        const partRecord = part as Record<string, JsonValue>;
        if (partRecord.type === "video_url") {
          return true;
        }
      }
    }
  }

  return false;
}

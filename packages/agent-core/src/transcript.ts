import {
  cloneLlmMessageContent,
  type LlmMessage,
  type LlmMessageContent,
  type LlmToolCall,
} from './ports.js';
import { isManualCompactionUiStatusLlmMessage } from './compaction-ui-status.js';

export const SESSION_TRANSCRIPT_EXPORT_VERSION = 1;

export interface SessionTranscriptMessage {
  role: 'user' | 'assistant';
  content: LlmMessageContent;
  toolCalls?: LlmToolCall[];
}

export interface SessionTranscript {
  export_version: typeof SESSION_TRANSCRIPT_EXPORT_VERSION;
  kind: 'session_transcript';
  exported_at_unix_ms: number;
  message_count: number;
  messages: SessionTranscriptMessage[];
}

export function buildSessionTranscript(
  history: readonly LlmMessage[],
  exportedAtUnixMs: number = Date.now(),
): SessionTranscript {
  const messages = history.flatMap((message): SessionTranscriptMessage[] => {
    if (message.role !== 'user' && message.role !== 'assistant') {
      return [];
    }
    if (isManualCompactionUiStatusLlmMessage(message)) {
      return [];
    }

    const entry: SessionTranscriptMessage = {
      role: message.role,
      content: cloneLlmMessageContent(message.content),
    };

    if (message.role === 'assistant' && message.toolCalls !== undefined && message.toolCalls.length > 0) {
      entry.toolCalls = message.toolCalls.map((toolCall) => ({
        id: toolCall.id,
        name: toolCall.name,
        argumentsJson: toolCall.argumentsJson,
      }));
    }

    return [entry];
  });

  return {
    export_version: SESSION_TRANSCRIPT_EXPORT_VERSION,
    kind: 'session_transcript',
    exported_at_unix_ms: exportedAtUnixMs,
    message_count: messages.length,
    messages,
  };
}

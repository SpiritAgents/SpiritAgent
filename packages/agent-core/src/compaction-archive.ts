import {
  cloneLlmMessageContent,
  type LlmMessage,
  type LlmMessageContent,
  type LlmToolCall,
  type StoredLlmMessageArchiveEntry,
} from './ports.js';

export const PRE_COMPACTION_HISTORY_EXPORT_VERSION = 1;

export const PRE_COMPACTION_ARCHIVE_SECTION_HEADER = '[Pre-compaction Archive]';

export interface PreCompactionHistoryArchiveMessage {
  role: 'user' | 'assistant';
  content: LlmMessageContent;
  toolCalls?: LlmToolCall[];
}

export interface PreCompactionHistoryArchive {
  export_version: typeof PRE_COMPACTION_HISTORY_EXPORT_VERSION;
  kind: 'pre_compaction_history';
  exported_at_unix_ms: number;
  message_count: number;
  messages: PreCompactionHistoryArchiveMessage[];
}

export function buildPreCompactionHistoryArchive(
  history: readonly LlmMessage[],
  exportedAtUnixMs: number = Date.now(),
): PreCompactionHistoryArchive {
  const messages = history.flatMap((message): PreCompactionHistoryArchiveMessage[] => {
    if (message.role !== 'user' && message.role !== 'assistant') {
      return [];
    }

    const entry: PreCompactionHistoryArchiveMessage = {
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
    export_version: PRE_COMPACTION_HISTORY_EXPORT_VERSION,
    kind: 'pre_compaction_history',
    exported_at_unix_ms: exportedAtUnixMs,
    message_count: messages.length,
    messages,
  };
}

export function toStoredPreCompactionHistoryMessages(
  archive: PreCompactionHistoryArchive,
): StoredLlmMessageArchiveEntry[] {
  return archive.messages.map((message) => ({
    role: message.role,
    content: message.content,
    ...(message.toolCalls !== undefined ? { toolCalls: message.toolCalls } : {}),
  }));
}

export function appendPreCompactionArchiveToCompactSummary(
  summary: string,
  archivePath: string,
): string {
  const trimmedSummary = summary.trim();
  const normalizedPath = archivePath.trim();
  if (!normalizedPath) {
    return trimmedSummary;
  }

  const archiveSection = [
    PRE_COMPACTION_ARCHIVE_SECTION_HEADER,
    normalizedPath,
    'Important details may be recovered by reading this file with read_file.',
  ].join('\n');

  if (trimmedSummary.includes(PRE_COMPACTION_ARCHIVE_SECTION_HEADER)) {
    return trimmedSummary;
  }

  return trimmedSummary.length > 0 ? `${trimmedSummary}\n\n${archiveSection}` : archiveSection;
}

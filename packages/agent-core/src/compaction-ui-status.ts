import { llmMessageTextContent, type LlmMessage } from './ports.js';

export const MANUAL_COMPACTION_SKIPPED_STATUS_ZH =
  '当前可压缩历史较少，已跳过压缩。';

/** UI-only manual compaction status lines; must not enter llmHistory or pre-compaction archives. */
export function isManualCompactionUiStatusText(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }
  if (normalized === MANUAL_COMPACTION_SKIPPED_STATUS_ZH) {
    return true;
  }
  if (normalized.startsWith('压缩完成：上下文消息')) {
    return true;
  }
  if (normalized.startsWith('压缩失败:')) {
    return true;
  }
  return false;
}

export function isManualCompactionUiStatusLlmMessage(message: LlmMessage): boolean {
  if (message.role !== 'assistant') {
    return false;
  }
  if (message.toolCalls !== undefined && message.toolCalls.length > 0) {
    return false;
  }
  return isManualCompactionUiStatusText(llmMessageTextContent(message.content));
}

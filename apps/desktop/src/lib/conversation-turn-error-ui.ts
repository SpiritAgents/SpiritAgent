import type { ConversationMessageSnapshot } from '@/types';

export function isTurnErrorAssistantMessage(
  message: Pick<ConversationMessageSnapshot, 'role' | 'content' | 'aux'>,
): boolean {
  return message.role === 'assistant' && message.aux?.turnError === true && message.content.trim().length > 0;
}

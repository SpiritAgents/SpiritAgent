import type { ConversationMessageSnapshot } from '../types.js';

export type TurnContinuePresentation = {
  continuableMessage: ConversationMessageSnapshot;
  /** List index where the Continue button should render (last row in the interrupted turn). */
  showContinueAtIndex: number;
};

function lastUserMessageIndex(messages: readonly ConversationMessageSnapshot[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      return index;
    }
  }
  return -1;
}

/** Continue 应显示在当前轮最后一条消息之后，而非 Thinking 卡片内部（工具行在其后）。 */
export function resolveTurnContinuePresentation(
  messages: readonly ConversationMessageSnapshot[],
): TurnContinuePresentation | undefined {
  let continuableMessage: ConversationMessageSnapshot | undefined;
  const lastUser = lastUserMessageIndex(messages);
  if (lastUser < 0) {
    return undefined;
  }

  let lastIndexInTurn = lastUser;
  for (let index = lastUser + 1; index < messages.length; index += 1) {
    const message = messages[index];
    if (!message) {
      continue;
    }
    lastIndexInTurn = index;
    if (message.canContinue === true) {
      continuableMessage = message;
    }
  }

  if (!continuableMessage) {
    return undefined;
  }

  return {
    continuableMessage,
    showContinueAtIndex: lastIndexInTurn,
  };
}

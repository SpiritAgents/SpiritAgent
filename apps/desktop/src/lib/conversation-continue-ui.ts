import type { ConversationMessageSnapshot } from '../types.js';

export type TurnContinuePresentation = {
  continuableMessage: ConversationMessageSnapshot;
  /** List index where the turn action toolbar (Continue / Fork) should render. */
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

function lastUserMessageIndexBefore(
  messages: readonly ConversationMessageSnapshot[],
  messageIndex: number,
): number {
  for (let index = messageIndex; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      return index;
    }
  }
  return -1;
}

function isAssistantBodyTextMessage(message: ConversationMessageSnapshot | undefined): boolean {
  return Boolean(message?.role === 'assistant' && !message.tool && message.content.trim());
}

function findLastAssistantBodyTextIndexInTurn(
  messages: readonly ConversationMessageSnapshot[],
  messageIndex: number,
): number | null {
  const turnStart = lastUserMessageIndexBefore(messages, messageIndex);
  let lastIndex: number | null = null;
  for (let index = turnStart + 1; index < messages.length; index += 1) {
    const message = messages[index];
    if (!message || message.role === 'user') {
      break;
    }
    if (isAssistantBodyTextMessage(message)) {
      lastIndex = index;
    }
  }
  return lastIndex;
}

function activeTurnHasAssistantBodyText(messages: readonly ConversationMessageSnapshot[]): boolean {
  const lastUser = lastUserMessageIndex(messages);
  if (lastUser < 0) {
    return false;
  }
  return findLastAssistantBodyTextIndexInTurn(messages, messages.length - 1) !== null;
}

function resolveContinueToolbarHostIndex(
  messages: readonly ConversationMessageSnapshot[],
  lastUser: number,
  lastIndexInTurn: number,
  continuableMessage: ConversationMessageSnapshot,
): number {
  const bodyHost = findLastAssistantBodyTextIndexInTurn(messages, lastIndexInTurn);
  if (bodyHost !== null) {
    return bodyHost;
  }
  for (let index = lastUser + 1; index <= lastIndexInTurn; index += 1) {
    const message = messages[index];
    if (message?.id === continuableMessage.id) {
      return index;
    }
  }
  return lastIndexInTurn;
}

/** Continue 应显示在当前轮最后一条 assistant 正文之后；无正文时挂在可继续的 thinking/tool 行。 */
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
    showContinueAtIndex: resolveContinueToolbarHostIndex(
      messages,
      lastUser,
      lastIndexInTurn,
      continuableMessage,
    ),
  };
}

export function shouldShowContinueToolbarOnProcessGroup(
  messageIndices: readonly number[],
  messages: readonly ConversationMessageSnapshot[],
  turnContinue: TurnContinuePresentation | undefined,
  conversationIsBusy: boolean,
  activeSessionReadOnly: boolean,
): boolean {
  if (!turnContinue || conversationIsBusy || activeSessionReadOnly) {
    return false;
  }
  if (activeTurnHasAssistantBodyText(messages)) {
    return false;
  }
  const continuableIndex = messages.findIndex(
    (message) => message.id === turnContinue.continuableMessage.id,
  );
  if (continuableIndex < 0 || !messageIndices.includes(continuableIndex)) {
    return false;
  }
  return turnContinue.showContinueAtIndex === continuableIndex;
}

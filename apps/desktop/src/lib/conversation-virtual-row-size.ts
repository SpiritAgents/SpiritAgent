import type { ConversationRenderItem } from '@/lib/conversation-process-groups';
import {
  conversationRenderItemGapBeforePx,
  shouldCompactAfterPreviousRenderItem,
  shouldTightenAfterPreviousRenderItem,
} from '@/lib/message-card-spacing';
import type { ConversationMessageSnapshot } from '@/types';

// 估高误差 = virtual-core 首测补偿量 = 手动上滑时的可感知跳变幅度（补偿同步写
// scrollTop，行位置经 React 异步更新，错帧暴露为跳动），故必须贴近实测：
// process-group 按「折叠态」量取（展开由实测缓存接管），数值来自长会话 demo 实测。
const PROCESS_GROUP_BODY_ESTIMATE_PX = 20;
const USER_MESSAGE_BODY_ESTIMATE_PX = 68;
const TOOL_MESSAGE_BODY_ESTIMATE_PX = 52;
const ASSISTANT_BODY_ESTIMATE_PX = 253;
const ASSISTANT_META_BODY_ESTIMATE_PX = 92;
const FALLBACK_BODY_ESTIMATE_PX = 132;

function gapBeforePxForRenderIndex(
  index: number,
  items: readonly ConversationRenderItem[],
  messages: readonly ConversationMessageSnapshot[],
  messageIndex: number,
): number {
  const previousItem = items[index - 1];
  const message = messages[messageIndex];
  if (!message) {
    return 0;
  }
  return conversationRenderItemGapBeforePx({
    isFirst: index === 0,
    compactAfterPrevious: shouldCompactAfterPreviousRenderItem(previousItem, message, messages),
    tightenAfterPreviousMeta: shouldTightenAfterPreviousRenderItem(
      previousItem,
      message,
      messages,
      messageIndex,
    ),
  });
}

function bodyEstimateForMessage(message: ConversationMessageSnapshot): number {
  if (message.role === 'user') {
    return USER_MESSAGE_BODY_ESTIMATE_PX;
  }
  if (message.tool) {
    return TOOL_MESSAGE_BODY_ESTIMATE_PX;
  }
  if (message.content.trim()) {
    return ASSISTANT_BODY_ESTIMATE_PX;
  }
  return ASSISTANT_META_BODY_ESTIMATE_PX;
}

export function conversationRenderItemGapBeforePxAt(
  index: number,
  items: readonly ConversationRenderItem[],
  messages: readonly ConversationMessageSnapshot[],
): number {
  const item = items[index];
  if (!item) {
    return 0;
  }
  const messageIndex =
    item.kind === 'process-group' ? item.messageIndices[0] : item.messageIndex;
  if (messageIndex === undefined) {
    return 0;
  }
  return gapBeforePxForRenderIndex(index, items, messages, messageIndex);
}

export function estimateConversationRenderItemHeight(
  index: number,
  items: readonly ConversationRenderItem[],
  messages: readonly ConversationMessageSnapshot[],
): number {
  const item = items[index];
  if (!item) {
    return FALLBACK_BODY_ESTIMATE_PX;
  }

  if (item.kind === 'process-group') {
    const anchorIndex = item.messageIndices[0];
    const anchor = anchorIndex === undefined ? undefined : messages[anchorIndex];
    const gap = anchor
      ? gapBeforePxForRenderIndex(index, items, messages, anchorIndex)
      : 0;
    return gap + PROCESS_GROUP_BODY_ESTIMATE_PX;
  }

  const message = messages[item.messageIndex];
  if (!message) {
    return FALLBACK_BODY_ESTIMATE_PX;
  }

  const gap = gapBeforePxForRenderIndex(index, items, messages, item.messageIndex);
  return gap + bodyEstimateForMessage(message);
}

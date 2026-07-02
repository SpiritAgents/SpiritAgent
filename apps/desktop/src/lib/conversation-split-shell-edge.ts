import { viewportLengthToScaleRootLocal } from "@/lib/ui-layout-scale";

export const CONVERSATION_SPLIT_SHELL_SELECTOR = "[data-conversation-split-shell]";
export const CONVERSATION_SPLIT_SHELL_DIVIDER_ATTR =
  "data-spirit-conversation-split-shell-divider";

export function getConversationSplitShell(): HTMLElement | null {
  return document.querySelector<HTMLElement>(CONVERSATION_SPLIT_SHELL_SELECTOR);
}

/** Shell 内 absolute 定位须用本地长度，不可直接用 getBoundingClientRect 视口差值。 */
export function conversationSplitShellLocalLength(delta: number): number {
  return viewportLengthToScaleRootLocal(delta);
}

/** split 容器在 shell 内的 inset，横竖线均按此裁剪，避免嵌套时画出容器外。 */
export function conversationSplitShellInsetBounds(
  shell: HTMLElement,
  bounds: HTMLElement,
): { topPx: number; rightPx: number; bottomPx: number; leftPx: number } {
  const shellRect = shell.getBoundingClientRect();
  const boundsRect = bounds.getBoundingClientRect();
  return {
    topPx: conversationSplitShellLocalLength(Math.max(0, boundsRect.top - shellRect.top)),
    rightPx: conversationSplitShellLocalLength(Math.max(0, shellRect.right - boundsRect.right)),
    bottomPx: conversationSplitShellLocalLength(Math.max(0, shellRect.bottom - boundsRect.bottom)),
    leftPx: conversationSplitShellLocalLength(Math.max(0, boundsRect.left - shellRect.left)),
  };
}

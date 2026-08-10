/**
 * Pane 打字聚焦重定向的判定逻辑。
 *
 * 背景：拼音输入法是否接管按键，在按键事件到达应用时就已决定（Chromium 在
 * browser 进程完成 IME 分发，早于 renderer 的 keydown）。因此只在 keydown 里
 * 聚焦或注入字符，首字符永远吃不到 IME 候选窗。正确姿势是尽量提前把 DOM 焦点
 * 放进 composer（点击预聚焦），keydown 重定向仅作兜底，且必须只聚焦、不拦截
 * 默认行为，让原生按键管线把字符送进刚聚焦的 contenteditable。
 */

/** 目标自身可编辑或可激活时不重定向：按钮/链接/菜单项等要保留 Enter/空格语义。 */
export const TYPING_FOCUS_REDIRECT_INTERACTIVE_SELECTOR = [
  "button",
  "a[href]",
  "summary",
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="combobox"]',
  '[role="textbox"]',
  '[tabindex]:not([tabindex="-1"])',
  ".xterm",
  ".monaco-editor",
].join(", ");

/** 目标处于弹层内时不重定向：对话框 / 菜单 / 列表框里的按键归弹层所有。 */
export const TYPING_FOCUS_REDIRECT_OVERLAY_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

type TargetLike = Pick<HTMLElement, "tagName" | "isContentEditable" | "closest"> | null;

export type TypingFocusRedirectKeyEvent = Pick<
  KeyboardEvent,
  "defaultPrevented" | "ctrlKey" | "metaKey" | "altKey" | "key"
> & {
  target: EventTarget | null;
};

/** 目标是可编辑元素（含 composer 自身、xterm/monaco 的隐藏 textarea）。 */
export function isTypingFocusRedirectEditableTarget(target: TargetLike): boolean {
  if (!target) {
    return false;
  }
  return (
    target.tagName === "TEXTAREA" ||
    target.tagName === "INPUT" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

function isInteractiveOrOverlayTarget(target: TargetLike): boolean {
  if (!target) {
    return false;
  }
  return (
    target.closest(TYPING_FOCUS_REDIRECT_INTERACTIVE_SELECTOR) !== null ||
    target.closest(TYPING_FOCUS_REDIRECT_OVERLAY_SELECTOR) !== null
  );
}

/**
 * keydown 兜底：无修饰键的可打印字符、目标既不可编辑也不可交互时，
 * 应把焦点同步移入焦点 Pane 的 composer（调用方只 focus，不 preventDefault）。
 */
export function shouldRedirectKeydownToComposer(event: TypingFocusRedirectKeyEvent): boolean {
  if (event.defaultPrevented) {
    return false;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  if (event.key.length !== 1) {
    return false;
  }
  const target = event.target as TargetLike;
  if (isTypingFocusRedirectEditableTarget(target)) {
    return false;
  }
  if (isInteractiveOrOverlayTarget(target)) {
    return false;
  }
  return true;
}

/**
 * 点击预聚焦（IME 主路径）：点击 pane 内非交互区域且没有拖出选区时，
 * 应把 DOM 焦点预置进该 pane 的 composer，让随后的首个按键即被 IME 接管。
 * 拖选文本（选区非 collapsed）时不动焦点，保留 Cmd+C 复制。
 */
export function shouldPrefocusComposerOnPaneClick(
  target: EventTarget | null,
  selectionCollapsed: boolean,
): boolean {
  if (!selectionCollapsed) {
    return false;
  }
  const targetLike = target as TargetLike;
  if (isTypingFocusRedirectEditableTarget(targetLike)) {
    return false;
  }
  if (isInteractiveOrOverlayTarget(targetLike)) {
    return false;
  }
  return true;
}

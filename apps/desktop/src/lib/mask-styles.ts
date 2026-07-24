import type { CSSProperties } from "react";

/** 横向末端渐隐（workspace 选项卡关闭按钮等）：略强于默认 50%，实心区仅限 X 附近。 */
export const maskFadeHorizontalEnd: CSSProperties = {
  maskImage: "linear-gradient(to right, transparent 0%, black 42%)",
  WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 42%)",
};

/** 会话侧栏：顶栏按钮与下方滚动列表之间的固定间距（与渐隐遮罩 / Mica 无关）。 */
export const sidebarSessionsScrollTopGapClass = "pt-4";

/** 列表底缘渐隐：与 session-sidebar 共用 `--sidebar-mask-bottom-alpha` 及 150ms 过渡。 */
const LIST_BOTTOM_SCROLL_FADE_MASK =
  "linear-gradient(to bottom, black calc(100% - 56px), rgb(0 0 0 / var(--sidebar-mask-bottom-alpha)) 100%)";

/** `hasMoreBelow` 为 true 时底缘渐隐可见；滚到底时渐隐淡出。 */
export function bottomScrollFadeMaskStyle(
  hasMoreBelow: boolean,
  options?: { animate?: boolean },
): CSSProperties {
  return {
    "--sidebar-mask-bottom-alpha": hasMoreBelow ? "0" : "1",
    maskImage: LIST_BOTTOM_SCROLL_FADE_MASK,
    WebkitMaskImage: LIST_BOTTOM_SCROLL_FADE_MASK,
    ...(options?.animate !== false
      ? { transition: "--sidebar-mask-bottom-alpha 150ms" }
      : {}),
  } as CSSProperties;
}

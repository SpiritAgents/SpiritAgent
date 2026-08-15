import type { CSSProperties } from "react";

/** 横向末端渐隐（workspace 选项卡关闭按钮等）。 */
export const maskFadeHorizontalEnd: CSSProperties = {
  maskImage: "linear-gradient(to right, transparent, black 50%)",
  WebkitMaskImage: "linear-gradient(to right, transparent, black 50%)",
};

/** 会话侧栏：顶栏按钮与下方滚动列表之间的固定间距（与渐隐遮罩 / translucency 无关）。 */
export const sidebarSessionsScrollTopGapClass = "pt-4";

/**
 * 横向左右缘渐隐：与 session-sidebar 上下遮罩同算法（mask-image + 可插值 alpha），
 * 裁切内容透明露出下层背景，不硬编码遮罩颜色。
 */
const HORIZONTAL_EDGE_FADE_MASK =
  "linear-gradient(to right, rgb(0 0 0 / var(--mask-fade-left-alpha)) 0, black 1.25rem, black calc(100% - 1.25rem), rgb(0 0 0 / var(--mask-fade-right-alpha)) 100%)";

/** `left` / `right` 为 true 时对应侧缘渐隐可见；`rightDurationMs` 可让右缘过渡比左缘慢。 */
export function horizontalEdgeFadeMaskStyle(
  left: boolean,
  right: boolean,
  options?: { animate?: boolean; durationMs?: number; rightDurationMs?: number },
): CSSProperties {
  const durationMs = options?.durationMs ?? 150;
  const rightDurationMs = options?.rightDurationMs ?? durationMs;
  return {
    "--mask-fade-left-alpha": left ? "0" : "1",
    "--mask-fade-right-alpha": right ? "0" : "1",
    maskImage: HORIZONTAL_EDGE_FADE_MASK,
    WebkitMaskImage: HORIZONTAL_EDGE_FADE_MASK,
    ...(options?.animate
      ? {
          transition: `--mask-fade-left-alpha ${durationMs}ms, --mask-fade-right-alpha ${rightDurationMs}ms`,
        }
      : { transition: "none" }),
  } as unknown as CSSProperties;
}

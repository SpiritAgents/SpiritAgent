import type { CSSProperties } from "react";

/** Horizontal end fade-out (workspace tab close button, etc.): slightly stronger than the default 50%, with the solid zone limited to near the X. */
export const maskFadeHorizontalEnd: CSSProperties = {
  maskImage: "linear-gradient(to right, transparent 0%, black 42%)",
  WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 42%)",
};

/** Session sidebar: fixed gap between the top-bar buttons and the scroll list below (unrelated to the fade mask / translucency). */
export const sidebarSessionsScrollTopGapClass = "pt-4";

/** List bottom-edge fade-out: shares `--sidebar-mask-bottom-alpha` and the 150ms transition with session-sidebar. */
const LIST_BOTTOM_SCROLL_FADE_MASK =
  "linear-gradient(to bottom, black calc(100% - 56px), rgb(0 0 0 / var(--sidebar-mask-bottom-alpha)) 100%)";

/** The bottom-edge fade-out is visible when `hasMoreBelow` is true; it fades away when scrolled to the bottom. */
export function bottomScrollFadeMaskStyle(
  hasMoreBelow: boolean,
  options?: { animate?: boolean },
): CSSProperties {
  return {
    "--sidebar-mask-bottom-alpha": hasMoreBelow ? "0" : "1",
    maskImage: LIST_BOTTOM_SCROLL_FADE_MASK,
    WebkitMaskImage: LIST_BOTTOM_SCROLL_FADE_MASK,
    ...(options?.animate !== false ? { transition: "--sidebar-mask-bottom-alpha 150ms" } : {}),
  } as CSSProperties;
}

import type { ComponentRef } from "react";

import type { ScrollArea } from "@/components/ui/scroll-area";

export function scrollAreaViewport(
  root: ComponentRef<typeof ScrollArea> | null,
): HTMLElement | null {
  return root?.querySelector("[data-radix-scroll-area-viewport]") ?? null;
}

export function scrollAreaToBottom(viewport: HTMLElement): void {
  viewport.scrollTop = viewport.scrollHeight;
}

export function scrollDistanceFromBottom(viewport: HTMLElement): number {
  return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
}

export function isScrollNearBottom(viewport: HTMLElement, thresholdPx = 48): boolean {
  return scrollDistanceFromBottom(viewport) <= thresholdPx;
}

/** 在 ScrollArea viewport 内滚动元素，保留 paddingHost 的 padding 留白（scrollIntoView 不会计入） */
export function scrollIntoViewportWithPadding(
  viewport: HTMLElement,
  item: HTMLElement,
  paddingHost: HTMLElement | null | undefined,
): void {
  const style = paddingHost ? getComputedStyle(paddingHost) : null;
  const paddingTop = style ? Number.parseFloat(style.paddingTop) || 0 : 0;
  const paddingBottom = style ? Number.parseFloat(style.paddingBottom) || 0 : 0;

  const itemRect = item.getBoundingClientRect();
  const viewportRect = viewport.getBoundingClientRect();

  let scrollDelta = 0;

  const overflowBottom = itemRect.bottom - (viewportRect.bottom - paddingBottom);
  if (overflowBottom > 0) {
    scrollDelta += overflowBottom;
  }

  const overflowTop = viewportRect.top + paddingTop - itemRect.top;
  if (overflowTop > 0) {
    scrollDelta -= overflowTop;
  }

  if (scrollDelta === 0) {
    return;
  }

  viewport.scrollTop = Math.max(
    0,
    Math.min(viewport.scrollTop + scrollDelta, viewport.scrollHeight - viewport.clientHeight),
  );
}

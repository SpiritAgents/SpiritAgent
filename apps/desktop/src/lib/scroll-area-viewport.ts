import type { ComponentRef } from "react";

import type { ScrollArea } from "@/components/ui/scroll-area";

export function scrollAreaViewport(
  root: ComponentRef<typeof ScrollArea> | null,
): HTMLElement | null {
  return root?.querySelector("[data-radix-scroll-area-viewport]") ?? null;
}

export function scrollAreaToBottom(
  viewport: HTMLElement,
  behavior: ScrollBehavior = "auto",
): void {
  const top = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  const useSmooth =
    behavior === "smooth" &&
    !(
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  if (useSmooth) {
    viewport.scrollTo({ top, behavior: "smooth" });
    return;
  }
  viewport.scrollTop = top;
}

/**
 * 缓动滚向「当前」底部：每帧重读 scrollHeight，流式增高时终点跟着走，
 * 避免原生 scrollTo(smooth) 锁死点击瞬间的高度、结束后再瞬跳。
 */
export function scrollAreaAnimateToLiveBottom(
  viewport: HTMLElement,
  options?: { onDone?: () => void },
): () => void {
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) {
    const top = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    viewport.scrollTop = top;
    options?.onDone?.();
    return () => {};
  }

  let cancelled = false;
  const startTop = viewport.scrollTop;
  const startTime = performance.now();
  const initialTarget = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  const initialDistance = Math.max(0, initialTarget - startTop);
  const durationMs = Math.min(520, Math.max(220, initialDistance * 0.45));
  const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

  const frame = (now: number) => {
    if (cancelled) {
      return;
    }
    const liveTarget = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const t = Math.min(1, (now - startTime) / durationMs);
    viewport.scrollTop = startTop + (liveTarget - startTop) * easeOutCubic(t);
    if (t < 1) {
      requestAnimationFrame(frame);
      return;
    }
    viewport.scrollTop = liveTarget;
    options?.onDone?.();
  };
  requestAnimationFrame(frame);
  return () => {
    cancelled = true;
  };
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

import { useCallback, useEffect, useLayoutEffect, useRef, type ComponentRef, type RefObject } from "react";

import type { ScrollArea } from "@/components/ui/scroll-area";
import {
  isScrollNearBottom,
  scrollAreaToBottom,
  scrollAreaViewport,
} from "@/lib/scroll-area-viewport";
import type { ConversationMessageSnapshot, PendingAssistantAux } from "@/types";

const STICK_TO_BOTTOM_THRESHOLD_PX = 48;

export type UseConversationStreamScrollTailOptions = {
  scrollAreaRef: RefObject<ComponentRef<typeof ScrollArea> | null>;
  messages: readonly ConversationMessageSnapshot[];
  pendingAuxState: PendingAssistantAux | undefined;
  isBusy: boolean;
  scrollBedPaddingPx: number;
  enabled: boolean;
};

function buildStreamContentSig(
  messages: readonly ConversationMessageSnapshot[],
  pendingAuxState: PendingAssistantAux | undefined,
): string {
  const last = messages[messages.length - 1];
  const auxSig = pendingAuxState
    ? `${pendingAuxState.kind}:${pendingAuxState.statusText.length}:${pendingAuxState.detailText?.length ?? 0}`
    : "";
  return `${messages.length}:${last?.id ?? ""}:${last?.content.length ?? 0}:${last?.pending === true ? 1 : 0}:${auxSig}`;
}

/**
 * 流式输出时若用户仍在尾部附近，持续滚到对话底部；用户上滚后停止跟随。
 *
 * 返回 pinScrollToTail 供虚拟列表在每次 commit 的 layout effect 里同步补钉：
 * 卡片高度动画每帧引发多轮布局反馈（行高变化 → 重测 → 重渲染 totalSize），
 * 浏览器 ResizeObserver 有循环上限，超限通知推迟到下一帧，仅靠内容 RO 钉底
 * 会让部分帧带着未钉底偏差上屏（实测 4~17px 振荡，即「居底展开过程卡片震动」）。
 */
export function useConversationStreamScrollTail({
  scrollAreaRef,
  messages,
  pendingAuxState,
  isBusy,
  scrollBedPaddingPx,
  enabled,
}: UseConversationStreamScrollTailOptions): { pinScrollToTail: () => void } {
  const stickToBottomRef = useRef(true);
  const prevBusyRef = useRef(false);
  const prevContentSigRef = useRef("");

  const scrollToTail = useCallback(
    (forceStick = false) => {
      if (forceStick) {
        stickToBottomRef.current = true;
      } else if (!stickToBottomRef.current) {
        return;
      }
      const viewport = scrollAreaViewport(scrollAreaRef.current);
      if (!viewport) {
        return;
      }
      scrollAreaToBottom(viewport);
    },
    [scrollAreaRef],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const root = scrollAreaRef.current;
    const viewport = scrollAreaViewport(root);
    if (!root || !viewport) {
      return;
    }

    // stick 语义 =「用户主动离开底部」，只能由用户输入解除，不能从 scroll 事件
    // 反推：流式期间内容频繁增删（收拢/终版渲染/clamp），scroll 事件送达时读到的
    // scrollTop 与距底都是过期信号——曾两次实测被误判为用户上滚（距底阈值版、
    // scrollTop 上移版），把跟底误关后内容 RO 不再重钉底，即「流式结束后上跳」。
    // 现规则（解除均以用户输入为锚点）：
    // - wheel 上滚 → 解除；
    // - viewport 外按下指针（Radix 滚动条拖动）→ 解除；
    // - viewport 内中键按下（Windows 自动滚动，后续滚动无 wheel 事件）→ 解除；
    // - viewport 内 pointerdown / touchstart（触屏拖动、拖选文本）期间 scrollTop
    //   减小 → 解除。触屏须单独用 touch 事件跟踪：Chromium 把触摸拖动判定为滚动
    //   时会发 pointercancel 并停发 pointer 事件，scroll 事件全部落在其后；而
    //   touchmove/touchend 在滚动期间持续存在。上滑在手指未离开时 scrollTop 即
    //   减小，故 touchend 后的惯性滚动无需再判；非手势期间的 scrollTop 减小
    //   （内容收拢/clamp）不解除，维持原设计意图。
    // scroll 事件仅在「向底部方向滚动且贴近底部」时恢复，永不解除。恢复必须带
    // 方向条件：从底部起步的上滑手势是渐进的，首个 scroll 事件送达时常仍在
    // 48px 阈值内（实测 dist=1），无方向条件会把刚被 wheel 关掉的 stick 立即
    // 误重开，之后侧栏开合等触发内容 RO 即钉底（「上滑一点点后开合侧栏跳底」）。
    // 方向仅用于打开而非关闭：误判最坏只是漏开一次，用户继续向下滚会补上。
    let pointerHeld = false;
    let touchActive = false;
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) {
        stickToBottomRef.current = false;
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !viewport.contains(event.target)) {
        stickToBottomRef.current = false;
        return;
      }
      if (event.button === 1) {
        stickToBottomRef.current = false;
        return;
      }
      if (event.pointerType !== "touch") {
        pointerHeld = true;
      }
    };
    const onPointerEnd = () => {
      pointerHeld = false;
    };
    const onTouchStart = () => {
      touchActive = true;
    };
    const onTouchEnd = () => {
      touchActive = false;
    };
    let lastScrollTop = viewport.scrollTop;
    const onScroll = () => {
      const top = viewport.scrollTop;
      const movedTowardBottom = top > lastScrollTop;
      const movedTowardTop = top < lastScrollTop;
      lastScrollTop = top;
      if ((pointerHeld || touchActive) && movedTowardTop) {
        stickToBottomRef.current = false;
        return;
      }
      if (
        !stickToBottomRef.current
        && movedTowardBottom
        && isScrollNearBottom(viewport, STICK_TO_BOTTOM_THRESHOLD_PX)
      ) {
        stickToBottomRef.current = true;
      }
    };

    viewport.addEventListener("wheel", onWheel, { passive: true });
    root.addEventListener("pointerdown", onPointerDown, { passive: true });
    viewport.addEventListener("touchstart", onTouchStart, { passive: true });
    // pointerup / touchend 可能发生在 viewport / 窗口之外（拖动后松手），须挂在 window 上
    window.addEventListener("pointerup", onPointerEnd, { passive: true });
    window.addEventListener("pointercancel", onPointerEnd, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      viewport.removeEventListener("wheel", onWheel);
      root.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      viewport.removeEventListener("scroll", onScroll);
    };
  }, [enabled, scrollAreaRef]);

  useLayoutEffect(() => {
    if (!enabled) {
      prevBusyRef.current = isBusy;
      return;
    }
    const busyStarted = !prevBusyRef.current && isBusy;
    prevBusyRef.current = isBusy;
    if (!busyStarted) {
      return;
    }
    scrollToTail(true);
    requestAnimationFrame(() => scrollToTail(true));
  }, [enabled, isBusy, scrollToTail]);

  const contentSig = buildStreamContentSig(messages, pendingAuxState);

  useLayoutEffect(() => {
    if (!enabled || !isBusy) {
      prevContentSigRef.current = contentSig;
      return;
    }
    if (contentSig === prevContentSigRef.current) {
      return;
    }
    prevContentSigRef.current = contentSig;
    scrollToTail();
    requestAnimationFrame(() => scrollToTail());
  }, [contentSig, enabled, isBusy, scrollToTail]);

  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }
    scrollToTail();
    requestAnimationFrame(() => scrollToTail());
  }, [enabled, scrollBedPaddingPx, scrollToTail]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const viewport = scrollAreaViewport(scrollAreaRef.current);
    const content = viewport?.firstElementChild;
    if (!viewport || !(content instanceof HTMLElement)) {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (!stickToBottomRef.current) {
        return;
      }
      scrollAreaToBottom(viewport);
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [enabled, scrollAreaRef]);

  return { pinScrollToTail: scrollToTail };
}

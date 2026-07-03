import { useLayoutEffect, useRef, useState, type ComponentRef, type RefObject } from "react";
import { flushSync } from "react-dom";

import type { ScrollArea } from "@/components/ui/scroll-area";
import {
  scrollAreaToBottom,
  scrollAreaViewport,
  scrollDistanceFromBottom,
} from "@/lib/scroll-area-viewport";

export type UseConversationSessionScrollTailOptions = {
  scrollAreaRef: RefObject<ComponentRef<typeof ScrollArea> | null>;
  /** 列表内容标识（session key + scope key + remount epoch）；变化即重新定底 */
  contentKey: string;
  /** 会话内容可见（非空、非导航占位隐藏）时才滚动 */
  enabled: boolean;
  /** 会话正在流式输出：内容持续增长无法在 paint 前收敛，走跨帧 rAF 定底 */
  streaming: boolean;
};

// 定底收敛帧数上限：切入正在流式输出的会话时 scrollHeight 持续增长、永不 settled，
// 到达上限后直接显示，交由 stream tail 继续跟随。
const SETTLE_MAX_FRAMES = 12;

/**
 * 切换 composer 会话（或列表 scope / remount epoch 变化）后定底到最新消息。
 *
 * 虚拟化下首帧按估高布局滚底，随后实测修正 totalSize 需再次滚底，两次可见位移
 * 即「进入会话卡两下」。故 settled（滚底后下一帧仍贴底）前返回 listSettling=true，
 * 由调用方隐藏列表（visibility:hidden 不影响布局测量），settled 后一次性显示。
 */
export function useConversationSessionScrollTail({
  scrollAreaRef,
  contentKey,
  enabled,
  streaming,
}: UseConversationSessionScrollTailOptions): { listSettling: boolean } {
  const previousContentKeyRef = useRef<string | null>(null);
  const [settling, setSettling] = useState(enabled);

  useLayoutEffect(() => {
    if (!enabled) {
      // 空会话等场景会卸载消息列表；下次重新可见时需再次定底
      previousContentKeyRef.current = null;
      setSettling(false);
      return;
    }

    const contentChanged = previousContentKeyRef.current !== contentKey;
    if (!contentChanged) {
      return;
    }

    let canceled = false;
    let rafId = 0;

    const finishSettle = (viewport: HTMLElement) => {
      setSettling(true);
      scrollAreaToBottom(viewport);

      if (!streaming) {
        queueMicrotask(() => {
          if (canceled) {
            return;
          }
          scrollAreaToBottom(viewport);
          previousContentKeyRef.current = contentKey;
          flushSync(() => setSettling(false));
        });
        return;
      }

      let frame = 0;
      const step = () => {
        if (canceled) {
          return;
        }
        frame += 1;
        if (scrollDistanceFromBottom(viewport) <= 1 || frame >= SETTLE_MAX_FRAMES) {
          previousContentKeyRef.current = contentKey;
          setSettling(false);
          return;
        }
        scrollAreaToBottom(viewport);
        rafId = requestAnimationFrame(step);
      };
      rafId = requestAnimationFrame(step);
    };

    const viewport = scrollAreaViewport(scrollAreaRef.current);
    if (viewport) {
      finishSettle(viewport);
      return () => {
        canceled = true;
        cancelAnimationFrame(rafId);
      };
    }

    // Radix viewport 可能晚于 contentKey 变化一帧挂载；勿标记 key 已处理，轮询至可用。
    setSettling(true);
    const waitForViewport = () => {
      if (canceled) {
        return;
      }
      const nextViewport = scrollAreaViewport(scrollAreaRef.current);
      if (!nextViewport) {
        rafId = requestAnimationFrame(waitForViewport);
        return;
      }
      finishSettle(nextViewport);
    };
    rafId = requestAnimationFrame(waitForViewport);

    return () => {
      canceled = true;
      cancelAnimationFrame(rafId);
    };
  }, [contentKey, enabled, streaming, scrollAreaRef]);

  return { listSettling: settling };
}

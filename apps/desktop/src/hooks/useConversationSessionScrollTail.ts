import { useLayoutEffect, useRef, useState, type ComponentRef, type RefObject } from "react";

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

    const viewport = scrollAreaViewport(scrollAreaRef.current);
    if (!viewport) {
      previousContentKeyRef.current = contentKey;
      setSettling(false);
      return;
    }

    setSettling(true);
    scrollAreaToBottom(viewport);

    let frame = 0;
    let rafId = requestAnimationFrame(function step() {
      frame += 1;
      // 帧首仍贴底 = 上一帧滚底后的实测修正没有把视口推离底部，视为 settled
      if (scrollDistanceFromBottom(viewport) <= 1 || frame >= SETTLE_MAX_FRAMES) {
        // 完成时才记录 key：StrictMode 挂载双跑会先启动循环、cleanup 随即取消，
        // 若在启动时记录，第二遍 effect 会因 same-key 提前返回，settling 永卡 true
        // （列表 visibility:hidden 不再恢复）。被取消的定底视为未发生，下次重做。
        previousContentKeyRef.current = contentKey;
        setSettling(false);
        return;
      }
      scrollAreaToBottom(viewport);
      rafId = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(rafId);
  }, [contentKey, enabled, scrollAreaRef]);

  return { listSettling: settling };
}

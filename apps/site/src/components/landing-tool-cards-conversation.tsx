import { useLayoutEffect, useRef } from "react";

import { LandingToolCallRow } from "@/components/landing-tool-call-row";
import { MarkdownMessage } from "@/components/markdown-message";
import {
  TOOL_CARDS_DEMO_STACK_ITEM_GAP_PX,
  type LandingToolCardsDemoItem,
} from "@/lib/landing-tool-cards-demo-script";
import { cn } from "@/lib/utils";
import { DESKTOP_ELEVATION_SHADOW_SM } from "@/lib/desktop-mica-surface";

const userBubbleClass = cn(
  "rounded-2xl rounded-br-md border border-ring/30 bg-background px-3 py-2.5 dark:border-border/50 dark:bg-muted",
  DESKTOP_ELEVATION_SHADOW_SM,
);

type LandingToolCardsConversationProps = {
  items: LandingToolCardsDemoItem[];
  enteringItemId: string | null;
};

function measureItemCenterOffset(viewport: HTMLElement, itemEl: HTMLElement) {
  const itemTop = itemEl.offsetTop;
  const itemHeight = itemEl.offsetHeight;
  const itemCenterInStack = itemTop + itemHeight / 2;
  const viewportCenter = viewport.clientHeight / 2;
  return viewportCenter - itemCenterInStack;
}

function computeStackTranslateY(
  viewport: HTMLElement,
  items: LandingToolCardsDemoItem[],
  itemRefs: (HTMLDivElement | null)[],
) {
  if (items.length === 0) {
    return 0;
  }

  const firstEl = itemRefs[0];
  if (!firstEl) {
    return 0;
  }

  let translateY = measureItemCenterOffset(viewport, firstEl);

  for (let index = 1; index < items.length; index += 1) {
    translateY -= TOOL_CARDS_DEMO_STACK_ITEM_GAP_PX;
  }

  return translateY;
}

export function LandingToolCardsConversation({
  items,
  enteringItemId,
}: LandingToolCardsConversationProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const stackRef = useRef<HTMLDivElement>(null);
  const lastItemsLengthRef = useRef(0);
  const forceRecomputeRef = useRef(false);

  useLayoutEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        forceRecomputeRef.current = true;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useLayoutEffect(() => {
    const stack = stackRef.current;
    if (!stack) {
      return;
    }

    if (items.length === 0) {
      stack.style.transform = "translateY(0px)";
      lastItemsLengthRef.current = 0;
      forceRecomputeRef.current = false;
      return;
    }

    const lengthChanged = items.length !== lastItemsLengthRef.current;
    const shouldRecompute = lengthChanged || forceRecomputeRef.current;

    if (!shouldRecompute) {
      return;
    }

    const applyStackOffset = () => {
      const currentStack = stackRef.current;
      const currentViewport = viewportRef.current;
      if (!currentStack || !currentViewport) {
        return;
      }

      const translateY = computeStackTranslateY(currentViewport, items, itemRefs.current);
      const snapStack = items.length === 1;

      lastItemsLengthRef.current = items.length;
      forceRecomputeRef.current = false;

      if (snapStack) {
        currentStack.style.transition = "none";
      }

      currentStack.style.transform = `translateY(${translateY}px)`;

      if (snapStack) {
        void currentStack.offsetHeight;
        requestAnimationFrame(() => {
          if (stackRef.current) {
            stackRef.current.style.transition = "";
          }
        });
      }
    };

    if (items.length <= 1) {
      applyStackOffset();
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(applyStackOffset);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [items]);

  return (
    <div ref={viewportRef} className="flex h-full min-h-0 flex-col overflow-hidden px-4 sm:px-5">
      <div
        ref={stackRef}
        className="flex w-full flex-col transition-transform duration-[380ms] ease-out motion-reduce:transition-none"
      >
        {items.map((item, index) => (
          <div
            key={item.id}
            ref={(element) => {
              itemRefs.current[index] = element;
            }}
            className="pb-3 last:pb-0"
          >
            <div
              className={cn(
                item.id === enteringItemId &&
                  item.id !== "user" &&
                  (item.kind === "tool"
                    ? "animate-in fade-in fill-mode-both duration-300 motion-reduce:animate-none"
                    : "animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300 motion-reduce:animate-none"),
              )}
            >
              {item.kind === "user" ? (
                <div className="flex w-full justify-end">
                  <div className={cn("max-w-[min(72%,22rem)]", userBubbleClass)}>
                    <pre className="m-0 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
                      {item.text}
                    </pre>
                  </div>
                </div>
              ) : null}

              {item.kind === "tool" ? (
                <LandingToolCallRow
                  headline={item.headline}
                  detail={item.detail}
                  phase={item.phase}
                  delta={item.delta}
                />
              ) : null}

              {item.kind === "assistant" ? (
                <div className="w-full min-w-0">
                  <MarkdownMessage
                    content={item.text}
                    streaming={item.pending}
                    className="font-sans"
                  />
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

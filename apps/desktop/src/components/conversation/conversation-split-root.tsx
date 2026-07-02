import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { useConversationSplit } from "@/contexts/conversation-split-context";
import { desktopMicaTintClass } from "@/lib/desktop-mica-surface";
import {
  clampSplitRatio,
  type SplitLayoutNode,
} from "@/lib/conversation-split-layout";
import { cn } from "@/lib/utils";

type ConversationSplitRootProps = {
  useMicaBackdrop: boolean;
  renderPane: (input: {
    paneId: string;
    sessionPath: string;
    isFocused: boolean;
    isAnchorPane: boolean;
    onFocusPane: () => void;
    onSplit: () => void;
    onClosePane: () => void;
    showClosePane: boolean;
  }) => ReactNode;
};

function SplitDivider({
  direction,
  useMicaBackdrop,
  onRatioChange,
}: {
  direction: "horizontal" | "vertical";
  useMicaBackdrop: boolean;
  onRatioChange: (ratio: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef<{ start: number; startRatio: number } | null>(null);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const container = containerRef.current?.parentElement;
    if (!container) {
      return;
    }
    const rect = container.getBoundingClientRect();
    const startRatio =
      direction === "horizontal"
        ? (event.clientX - rect.left) / Math.max(rect.width, 1)
        : (event.clientY - rect.top) / Math.max(rect.height, 1);
    dragRef.current = {
      start: direction === "horizontal" ? event.clientX : event.clientY,
      startRatio,
    };
    setIsResizing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [direction]);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      const container = containerRef.current?.parentElement;
      if (!drag || !container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      const nextRatio =
        direction === "horizontal"
          ? (event.clientX - rect.left) / Math.max(rect.width, 1)
          : (event.clientY - rect.top) / Math.max(rect.height, 1);
      onRatioChange(clampSplitRatio(nextRatio));
    },
    [direction, onRatioChange],
  );

  const endResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    setIsResizing(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // already released
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex min-h-0 min-w-0",
        direction === "horizontal" ? "h-full w-0 shrink-0" : "h-0 w-full shrink-0",
      )}
    >
      <div
        role="separator"
        aria-orientation={direction === "horizontal" ? "vertical" : "horizontal"}
        className={cn(
          "group relative z-20 touch-none select-none",
          direction === "horizontal"
            ? "h-full w-1 shrink-0 cursor-col-resize"
            : "h-1 w-full shrink-0 cursor-row-resize",
          isResizing ? "transition-none" : undefined,
          desktopMicaTintClass(useMicaBackdrop),
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endResize}
        onPointerCancel={endResize}
      >
        <div
          className={cn(
            "pointer-events-none absolute bg-border/40 transition-colors group-hover:bg-border/55",
            direction === "horizontal" ? "inset-y-0 left-0 w-px" : "inset-x-0 top-0 h-px",
          )}
          aria-hidden
        />
      </div>
    </div>
  );
}

function SplitLayoutRenderer({
  node,
  useMicaBackdrop,
  renderPane,
}: {
  node: SplitLayoutNode;
  useMicaBackdrop: boolean;
  renderPane: ConversationSplitRootProps["renderPane"];
}) {
  const split = useConversationSplit();

  if (node.kind === "leaf") {
    const isFocused = split.focusedPaneId === node.paneId;
    const isAnchorPane = split.anchorPaneId === node.paneId;
    return (
      <>
        {renderPane({
          paneId: node.paneId,
          sessionPath: node.sessionPath,
          isFocused,
          isAnchorPane,
          onFocusPane: () => split.focusPane(node.paneId, node.sessionPath),
          onSplit: () => {
            void split.splitPane(node.paneId, "horizontal");
          },
          onClosePane: () => {
            void split.closePaneById(node.paneId, node.sessionPath);
          },
          showClosePane: split.paneCount > 1,
        })}
      </>
    );
  }

  const isHorizontal = node.direction === "horizontal";
  const firstFlex = node.ratio;
  const secondFlex = 1 - node.ratio;

  return (
    <div
      data-spirit-surface="conversation-split"
      data-split-direction={node.direction}
      className={cn(
        "flex min-h-0 min-w-0 flex-1 overflow-hidden",
        isHorizontal ? "flex-row" : "flex-col",
      )}
    >
      <div
        className="flex min-h-0 min-w-0 overflow-hidden"
        style={{ flex: `${firstFlex} 1 0%` }}
      >
        <SplitLayoutRenderer
          node={node.first}
          useMicaBackdrop={useMicaBackdrop}
          renderPane={renderPane}
        />
      </div>
      <SplitDivider
        direction={node.direction}
        useMicaBackdrop={useMicaBackdrop}
        onRatioChange={(ratio) => split.updateRatio(node.splitId, ratio)}
      />
      <div
        className="flex min-h-0 min-w-0 overflow-hidden"
        style={{ flex: `${secondFlex} 1 0%` }}
      >
        <SplitLayoutRenderer
          node={node.second}
          useMicaBackdrop={useMicaBackdrop}
          renderPane={renderPane}
        />
      </div>
    </div>
  );
}

export function ConversationSplitRoot({
  useMicaBackdrop,
  renderPane,
}: ConversationSplitRootProps) {
  const { layout } = useConversationSplit();

  if (!layout) {
    return null;
  }

  return (
    <div
      data-spirit-surface="conversation-split-root"
      className="flex min-h-0 min-w-0 flex-1 overflow-hidden"
    >
      <SplitLayoutRenderer
        node={layout}
        useMicaBackdrop={useMicaBackdrop}
        renderPane={renderPane}
      />
    </div>
  );
}

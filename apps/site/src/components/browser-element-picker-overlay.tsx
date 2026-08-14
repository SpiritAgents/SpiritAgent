import { useEffect, useRef } from "react";

import type { BrowserPickerTarget } from "@/lib/design-mode-demo-state";
import {
  PICKER_OVERLAY_BACKGROUND,
  PICKER_OVERLAY_BORDER_RADIUS,
  PICKER_OVERLAY_RING,
  PICKER_OVERLAY_TRANSITION_MS,
} from "@/lib/browser-element-picker-styles";
import { cn } from "@/lib/utils";

type BrowserElementPickerOverlayProps = {
  targetRects: Partial<Record<BrowserPickerTarget, DOMRect>>;
  hoverTarget: BrowserPickerTarget | null;
  selectedTarget: BrowserPickerTarget | null;
  visible: boolean;
};

export function BrowserElementPickerOverlay({
  targetRects,
  hoverTarget,
  selectedTarget,
  visible,
}: BrowserElementPickerOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const activeTarget = selectedTarget ?? hoverTarget;

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !visible || !activeTarget) {
      if (overlay) {
        overlay.style.opacity = "0";
      }
      return;
    }

    const rect = targetRects[activeTarget];
    if (!rect) {
      overlay.style.opacity = "0";
      return;
    }

    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
    overlay.style.opacity = "1";
    overlay.style.boxShadow = PICKER_OVERLAY_RING;
    overlay.style.background = PICKER_OVERLAY_BACKGROUND;
    overlay.style.borderRadius = PICKER_OVERLAY_BORDER_RADIUS;
  }, [activeTarget, targetRects, visible]);

  if (!visible) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-20 opacity-0",
        selectedTarget ? "transition-none" : "transition-[left,top,width,height,opacity]",
      )}
      style={{
        transitionDuration: selectedTarget ? undefined : `${PICKER_OVERLAY_TRANSITION_MS}ms`,
      }}
    />
  );
}

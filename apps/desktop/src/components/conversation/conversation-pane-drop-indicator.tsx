import { useLayoutEffect, useRef } from "react";

import { useConversationSplit } from "@/contexts/conversation-split-context";
import {
  applyPickerOverlayBox,
  applyPickerOverlayGeometry,
  hidePickerOverlayBox,
} from "@/lib/browser-element-picker";
import { paneDropIndicatorRect, visiblePaneDropZonesForDrag } from "@/lib/conversation-pane-drop-preview";

const OVERLAY_MOTION_TRANSITION =
  "left 200ms ease-out, top 200ms ease-out, width 200ms ease-out, height 200ms ease-out, opacity 150ms ease-out";

/** Single viewport-fixed ring that glides between pane drop quadrants (matches browser element picker). */
export function ConversationPaneDropIndicator() {
  const { paneDragActive, paneDragSourcePaneId, paneDropTarget, paneCount } =
    useConversationSplit();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const motionEnabledRef = useRef(false);

  useLayoutEffect(() => {
    const el = overlayRef.current;
    if (!el) {
      return;
    }

    const shouldHide =
      !paneDragActive
      || !paneDropTarget
      || paneDropTarget.paneId === paneDragSourcePaneId;

    if (shouldHide) {
      if (el.style.opacity === "1" || motionEnabledRef.current) {
        el.style.transition = OVERLAY_MOTION_TRANSITION;
        hidePickerOverlayBox(el);
      } else {
        hidePickerOverlayBox(el);
      }
      motionEnabledRef.current = false;
      return;
    }

    const host = document.querySelector(
      `[data-pane-drop-host="${paneDropTarget.paneId}"]`,
    );
    if (!(host instanceof HTMLElement)) {
      el.style.transition = OVERLAY_MOTION_TRANSITION;
      hidePickerOverlayBox(el);
      motionEnabledRef.current = false;
      return;
    }

    const sourceHost = paneDragSourcePaneId
      ? document.querySelector(`[data-pane-drop-host="${paneDragSourcePaneId}"]`)
      : null;
    const visibleZones = visiblePaneDropZonesForDrag({
      paneCount,
      sourcePaneHost: sourceHost instanceof HTMLElement ? sourceHost : null,
      targetPaneHost: host,
    });
    if (!visibleZones.includes(paneDropTarget.zone)) {
      el.style.transition = OVERLAY_MOTION_TRANSITION;
      hidePickerOverlayBox(el);
      motionEnabledRef.current = false;
      return;
    }

    const rect = paneDropIndicatorRect(
      host.getBoundingClientRect(),
      paneDropTarget.zone,
      visibleZones,
    );

    if (!motionEnabledRef.current) {
      el.style.transition = "none";
      applyPickerOverlayGeometry(el, rect);
      el.style.opacity = "0";
      void el.offsetWidth;
      el.style.transition = OVERLAY_MOTION_TRANSITION;
      el.style.opacity = "1";
      motionEnabledRef.current = true;
      return;
    }

    el.style.transition = OVERLAY_MOTION_TRANSITION;
    applyPickerOverlayBox(el, rect);
  }, [paneCount, paneDragActive, paneDragSourcePaneId, paneDropTarget]);

  useLayoutEffect(() => {
    if (!paneDragActive) {
      motionEnabledRef.current = false;
    }
  }, [paneDragActive]);

  return (
    <div
      ref={overlayRef}
      aria-hidden
      className="pointer-events-none fixed z-[100] box-border opacity-0"
    />
  );
}

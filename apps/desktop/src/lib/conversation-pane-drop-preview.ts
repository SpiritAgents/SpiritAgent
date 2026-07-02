import type { MarqueeRect } from "@/lib/browser-element-picker";
import type { PaneRepositionZone } from "@/lib/conversation-split-layout";

/** 2×2 grid: TL above, TR after, BL before, BR below. */
export const PANE_DROP_ZONE_ORDER: readonly PaneRepositionZone[] = [
  "above",
  "after",
  "before",
  "below",
];

export const PANE_DROP_ZONE_GRID_CLASS: Record<PaneRepositionZone, string> = {
  above: "col-start-1 row-start-1",
  after: "col-start-2 row-start-1",
  before: "col-start-1 row-start-2",
  below: "col-start-2 row-start-2",
};

/**
 * Two-pane drag: hide the target edge facing the source (e.g. source on the right → hide after + below).
 */
export function hiddenPaneDropZonesForTwoPaneDrag(
  sourceRect: DOMRect,
  targetRect: DOMRect,
): ReadonlySet<PaneRepositionZone> {
  const sourceCx = sourceRect.left + sourceRect.width / 2;
  const sourceCy = sourceRect.top + sourceRect.height / 2;
  const targetCx = targetRect.left + targetRect.width / 2;
  const targetCy = targetRect.top + targetRect.height / 2;
  const dx = sourceCx - targetCx;
  const dy = sourceCy - targetCy;

  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx > 0) {
      return new Set(["after", "below"]);
    }
    return new Set(["above", "before"]);
  }

  if (dy > 0) {
    return new Set(["before", "below"]);
  }
  return new Set(["above", "after"]);
}

export function visiblePaneDropZonesForDrag(input: {
  paneCount: number;
  sourcePaneHost: HTMLElement | null;
  targetPaneHost: HTMLElement | null;
}): readonly PaneRepositionZone[] {
  if (
    input.paneCount !== 2
    || !input.sourcePaneHost
    || !input.targetPaneHost
  ) {
    return PANE_DROP_ZONE_ORDER;
  }

  const hidden = hiddenPaneDropZonesForTwoPaneDrag(
    input.sourcePaneHost.getBoundingClientRect(),
    input.targetPaneHost.getBoundingClientRect(),
  );
  return PANE_DROP_ZONE_ORDER.filter((zone) => !hidden.has(zone));
}

function visibleZonePair(
  visibleZones: readonly PaneRepositionZone[],
): "top-bottom" | "left-right" | null {
  if (visibleZones.length !== 2) {
    return null;
  }
  const set = new Set(visibleZones);
  if (set.has("above") && set.has("before")) {
    return "top-bottom";
  }
  if (set.has("after") && set.has("below")) {
    return "top-bottom";
  }
  if (set.has("above") && set.has("after")) {
    return "left-right";
  }
  if (set.has("before") && set.has("below")) {
    return "left-right";
  }
  return null;
}

/**
 * When two zones are expanded to a half-pane pair, grid cell labels (e.g. below = BR)
 * no longer match reposition semantics (below = vertical). Map to before/after/above/below.
 */
export function effectiveRepositionZone(
  zone: PaneRepositionZone,
  visibleZones: readonly PaneRepositionZone[],
): PaneRepositionZone {
  const pair = visibleZonePair(visibleZones);
  if (pair === "left-right") {
    if (zone === "above" || zone === "before") {
      return "before";
    }
    if (zone === "after" || zone === "below") {
      return "after";
    }
  }
  if (pair === "top-bottom") {
    if (zone === "above" || zone === "after") {
      return "above";
    }
    if (zone === "before" || zone === "below") {
      return "below";
    }
  }
  return zone;
}

/** Grid classes for the drop hit layer when some zones are hidden. */
export function paneDropZoneGridLayoutClass(
  visibleZones: readonly PaneRepositionZone[],
): string {
  const pair = visibleZonePair(visibleZones);
  if (pair === "top-bottom") {
    return "grid-cols-1 grid-rows-2";
  }
  if (pair === "left-right") {
    return "grid-cols-2 grid-rows-1";
  }
  return "grid-cols-2 grid-rows-2";
}

export function paneDropZoneRect(
  hostRect: DOMRect,
  zone: PaneRepositionZone,
  visibleZones: readonly PaneRepositionZone[] = PANE_DROP_ZONE_ORDER,
): MarqueeRect {
  const left = hostRect.left;
  const top = hostRect.top;
  const width = hostRect.width;
  const height = hostRect.height;
  const halfW = width / 2;
  const halfH = height / 2;
  const pair = visibleZonePair(visibleZones);

  if (pair === "top-bottom") {
    if (zone === "above" || zone === "after") {
      return {
        x: Math.round(left),
        y: Math.round(top),
        width: Math.round(width),
        height: Math.round(halfH),
      };
    }
    return {
      x: Math.round(left),
      y: Math.round(top + halfH),
      width: Math.round(width),
      height: Math.round(halfH),
    };
  }

  if (pair === "left-right") {
    if (zone === "above" || zone === "before") {
      return {
        x: Math.round(left),
        y: Math.round(top),
        width: Math.round(halfW),
        height: Math.round(height),
      };
    }
    return {
      x: Math.round(left + halfW),
      y: Math.round(top),
      width: Math.round(halfW),
      height: Math.round(height),
    };
  }

  switch (zone) {
    case "above":
      return {
        x: Math.round(left),
        y: Math.round(top),
        width: Math.round(halfW),
        height: Math.round(halfH),
      };
    case "after":
      return {
        x: Math.round(left + halfW),
        y: Math.round(top),
        width: Math.round(halfW),
        height: Math.round(halfH),
      };
    case "before":
      return {
        x: Math.round(left),
        y: Math.round(top + halfH),
        width: Math.round(halfW),
        height: Math.round(halfH),
      };
    case "below":
      return {
        x: Math.round(left + halfW),
        y: Math.round(top + halfH),
        width: Math.round(halfW),
        height: Math.round(halfH),
      };
  }
}

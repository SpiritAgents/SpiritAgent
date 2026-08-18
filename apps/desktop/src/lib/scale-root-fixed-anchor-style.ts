import type { CSSProperties } from "react";

import { viewportRectToScaleRootLocal, type ViewportBox } from "@/lib/ui-layout-scale";

/** Radix virtual trigger: getBoundingClientRect is in viewport coordinates; fixed positioning must use local coordinates within the scale root. */
export function scaleRootFixedAnchorStyle(rect: ViewportBox): CSSProperties {
  const local = viewportRectToScaleRootLocal(rect);
  return {
    position: "fixed",
    left: local.left,
    top: local.top,
    width: local.width,
    height: local.height,
    pointerEvents: "none",
  };
}

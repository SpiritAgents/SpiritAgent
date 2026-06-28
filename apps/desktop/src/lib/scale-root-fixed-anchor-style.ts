import type { CSSProperties } from "react";

import { viewportRectToScaleRootLocal, type ViewportBox } from "@/lib/ui-layout-scale";

/** Radix 虚拟 trigger：getBoundingClientRect 为视口坐标，fixed 须在缩放根内用本地坐标。 */
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

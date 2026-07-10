import type { CSSProperties } from "react";

import {
  SpiritGlassLogo,
  spiritGlassLogoMaskStyle,
} from "@/components/spirit-glass-logo";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useSpiritGlassLogoShimmerVisible } from "@/hooks/use-spirit-glass-logo-shimmer-visible";
import { cn } from "@/lib/utils";

export type SpiritGlassLogoShimmerProps = {
  width: number;
  shimmer?: boolean;
  className?: string;
  logoClassName?: string;
  style?: CSSProperties;
};

/** 与 launch-splash 一致的玻璃标 + 轮廓蒙版 shimmer 扫光。 */
export function SpiritGlassLogoShimmer({
  width,
  shimmer = false,
  className,
  logoClassName,
  style,
}: SpiritGlassLogoShimmerProps) {
  const reducedMotion = usePrefersReducedMotion();
  const shimmerVisible = useSpiritGlassLogoShimmerVisible(shimmer, reducedMotion);

  return (
    <div className={cn("relative shrink-0", className)} style={{ width, ...style }}>
      <SpiritGlassLogo width={width} className={cn("relative z-0", logoClassName)} />
      {shimmerVisible ? (
        <div
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
          style={spiritGlassLogoMaskStyle()}
          aria-hidden
          data-testid="spirit-glass-logo-shimmer"
        >
          <div className="spirit-launch-shimmer-sweep" />
        </div>
      ) : null}
    </div>
  );
}

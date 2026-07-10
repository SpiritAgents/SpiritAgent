import { useEffect, useRef, useState } from "react";

import {
  computeShimmerStopDelayMs,
  SPIRIT_GLASS_LOGO_SHIMMER_CYCLE_MS,
} from "@/lib/spirit-glass-logo-shimmer-cycle";

export function useSpiritGlassLogoShimmerVisible(
  active: boolean,
  reducedMotion: boolean,
): boolean {
  const [visible, setVisible] = useState(active);
  const visibleRef = useRef(active);
  const cycleStartedAtRef = useRef<number | null>(active ? Date.now() : null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }

    if (active) {
      if (!visibleRef.current) {
        cycleStartedAtRef.current = Date.now();
      }
      visibleRef.current = true;
      setVisible(true);
      return;
    }

    if (reducedMotion || !visibleRef.current) {
      cycleStartedAtRef.current = null;
      visibleRef.current = false;
      setVisible(false);
      return;
    }

    const startedAt = cycleStartedAtRef.current ?? Date.now();
    const delay = computeShimmerStopDelayMs(Date.now() - startedAt);
    stopTimerRef.current = setTimeout(() => {
      cycleStartedAtRef.current = null;
      visibleRef.current = false;
      setVisible(false);
      stopTimerRef.current = null;
    }, delay);

    return () => {
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
    };
  }, [active, reducedMotion]);

  return visible;
}

export { SPIRIT_GLASS_LOGO_SHIMMER_CYCLE_MS };

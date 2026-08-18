import { useEffect, useState } from "react";

import { COLLAPSIBLE_CLOSE_UNMOUNT_DELAY_MS } from "@/lib/collapsible-animation";

/** Mount immediately on expand; delay unmount after collapse, aligned with the AnimatedCollapse close animation. */
export function useCollapsibleChildMount(
  open: boolean,
  delayMs = COLLAPSIBLE_CLOSE_UNMOUNT_DELAY_MS,
): boolean {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), delayMs);
    return () => window.clearTimeout(timer);
  }, [open, delayMs]);

  return mounted;
}

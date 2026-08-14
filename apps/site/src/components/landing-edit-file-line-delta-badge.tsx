import { useLayoutEffect, useRef, useState } from "react";
import { FONT_WEIGHT_NORMAL } from "@/lib/typography";

import type { EditFileLineDelta } from "@/lib/landing-tool-cards-demo-script";
import { cn } from "@/lib/utils";

type SlideDirection = "up" | "down" | "none";

function AnimatedCount({ value, className }: { value: number; className: string }) {
  const previousRef = useRef(value);
  const [direction, setDirection] = useState<SlideDirection>("none");

  useLayoutEffect(() => {
    const previous = previousRef.current;
    if (value > previous) {
      setDirection("up");
    } else if (value < previous) {
      setDirection("down");
    } else {
      setDirection("none");
    }
    previousRef.current = value;
  }, [value]);

  return (
    <span
      className={cn(
        "relative inline-flex h-[1em] items-center overflow-hidden font-sans leading-none",
        className,
      )}
      aria-hidden
    >
      <span
        key={value}
        className={cn(
          "inline-block",
          direction === "up" && "spirit-edit-delta-slide-up",
          direction === "down" && "spirit-edit-delta-slide-down",
        )}
      >
        {value}
      </span>
    </span>
  );
}

export function LandingEditFileLineDeltaBadge({
  delta,
  className,
}: {
  delta: EditFileLineDelta;
  className?: string;
}) {
  if (delta.added === 0 && delta.removed === 0) {
    return null;
  }

  return (
    <span
      className={cn(
        `inline-flex shrink-0 items-center gap-1 font-sans text-xs ${FONT_WEIGHT_NORMAL} leading-none`,
        className,
      )}
    >
      {delta.added > 0 ? (
        <span className="inline-flex items-baseline leading-none text-emerald-600 dark:text-emerald-400">
          <span aria-hidden className="leading-none">
            +
          </span>
          <AnimatedCount value={delta.added} className="text-emerald-600 dark:text-emerald-400" />
        </span>
      ) : null}
      {delta.removed > 0 ? (
        <span className="inline-flex items-baseline leading-none text-red-500 dark:text-red-400">
          <span aria-hidden className="leading-none">
            -
          </span>
          <AnimatedCount value={delta.removed} className="text-red-500 dark:text-red-400" />
        </span>
      ) : null}
    </span>
  );
}

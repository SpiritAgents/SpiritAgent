import type { BrowserPickerTarget } from "@/lib/design-mode-demo-state";
import { cn } from "@/lib/utils";

type DesignModeDemoCursorProps = {
  containerRef: React.RefObject<HTMLElement | null>;
  targetRects: Partial<Record<BrowserPickerTarget, DOMRect>>;
  activeTarget: BrowserPickerTarget | null;
  visible: boolean;
  transitionMs?: number;
};

export function DesignModeDemoCursor({
  containerRef,
  targetRects,
  activeTarget,
  visible,
  transitionMs = 500,
}: DesignModeDemoCursorProps) {
  if (!visible || !activeTarget) {
    return null;
  }

  const rect = targetRects[activeTarget];
  const container = containerRef.current;
  if (!rect || !container) {
    return null;
  }

  const containerRect = container.getBoundingClientRect();
  const x = rect.left - containerRect.left + rect.width * 0.72;
  const y = rect.top - containerRect.top + rect.height * 0.55;

  return (
    <svg
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-30 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]",
        "transition-[left,top] ease-out motion-reduce:transition-none",
      )}
      width={18}
      height={22}
      viewBox="0 0 18 22"
      style={{ left: x, top: y, transitionDuration: `${transitionMs}ms` }}
    >
      <path
        d="M1 1l4.2 16.2L8.4 11 14.8 9.6 1 1z"
        fill="#fff"
        stroke="#111"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

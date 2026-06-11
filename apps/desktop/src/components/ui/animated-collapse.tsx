import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type AnimatedCollapseContextValue = {
  open: boolean;
  onOpenChange(nextOpen: boolean): void;
  contentId: string;
};

const AnimatedCollapseContext = createContext<AnimatedCollapseContextValue | null>(null);

function useAnimatedCollapseContext(component: string): AnimatedCollapseContextValue {
  const context = useContext(AnimatedCollapseContext);
  if (!context) {
    throw new Error(`${component} must be used within AnimatedCollapse`);
  }
  return context;
}

function syncAnimatedCollapseHeight(outer: HTMLElement, inner: HTMLElement): void {
  outer.style.setProperty("--spirit-collapsible-content-height", `${inner.scrollHeight}px`);
}

function AnimatedCollapse({
  open,
  defaultOpen,
  onOpenChange,
  className,
  children,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  children: ReactNode;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false);
  const isControlled = open !== undefined;
  const resolvedOpen = isControlled ? open : uncontrolledOpen;
  const contentId = useId();

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  return (
    <AnimatedCollapseContext.Provider
      value={{
        open: resolvedOpen,
        onOpenChange: handleOpenChange,
        contentId,
      }}
    >
      <div data-slot="animated-collapse" className={className}>
        {children}
      </div>
    </AnimatedCollapseContext.Provider>
  );
}

function AnimatedCollapseTrigger({
  className,
  children,
  ...props
}: ComponentProps<"button">) {
  const { open, onOpenChange, contentId } = useAnimatedCollapseContext("AnimatedCollapseTrigger");

  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={contentId}
      onClick={() => onOpenChange(!open)}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
}

function AnimatedCollapseContent({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const { open, contentId } = useAnimatedCollapseContext("AnimatedCollapseContent");
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) {
      return;
    }

    syncAnimatedCollapseHeight(outer, inner);

    const observer = new ResizeObserver(() => {
      if (!outerRef.current || !innerRef.current) {
        return;
      }
      syncAnimatedCollapseHeight(outerRef.current, innerRef.current);
    });
    observer.observe(inner);
    return () => observer.disconnect();
  }, [open, children]);

  return (
    <div
      ref={outerRef}
      id={contentId}
      data-slot="animated-collapse-content"
      data-state={open ? "open" : "closed"}
      className={cn(
        "overflow-hidden",
        "data-[state=open]:animate-spirit-collapsible-down data-[state=open]:[animation-fill-mode:forwards]",
        "data-[state=closed]:animate-spirit-collapsible-up data-[state=closed]:[animation-fill-mode:forwards]",
        className,
      )}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

export { AnimatedCollapse, AnimatedCollapseContent, AnimatedCollapseTrigger };

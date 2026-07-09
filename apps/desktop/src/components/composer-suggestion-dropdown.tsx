import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DESKTOP_OVERLAY_LIST_CONTENT,
  DESKTOP_OVERLAY_LIST_LIST_PADDING,
  DESKTOP_OVERLAY_LIST_SCROLL_AREA,
  DESKTOP_OVERLAY_LIST_WIDTH,
  stopOverlayScrollPropagation,
} from "@/lib/desktop-chrome";
import {
  RADIX_OVERLAY_CLOSE_MS,
  runAfterRadixOverlayClose,
} from "@/lib/overlay-motion";
import { scaleRootFixedAnchorStyle } from "@/lib/scale-root-fixed-anchor-style";
import { cn } from "@/lib/utils";

type ComposerSuggestionDropdownProps = {
  active: boolean;
  anchor: DOMRect | null;
  composerRootRef: RefObject<HTMLElement | null>;
  ariaLabel: string;
  onDismiss(): void;
  children: ReactNode;
  contentClassName?: string;
};

function isTargetWithinComposer(
  target: EventTarget | null,
  composerRoot: HTMLElement | null,
): boolean {
  return Boolean(target instanceof Node && composerRoot?.contains(target));
}

function focusComposerEditable(composerRoot: HTMLElement | null): void {
  const editable = composerRoot?.querySelector<HTMLElement>(
    '[contenteditable="true"], textarea, [role="textbox"]',
  );
  if (!editable || document.activeElement === editable) {
    return;
  }
  editable.focus({ preventScroll: true });
}

function isMenuFocusTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(
    target.closest('[data-slot="dropdown-menu-content"]')
    || target.closest('[data-radix-menu-content]'),
  );
}

export function ComposerSuggestionDropdown({
  active,
  anchor,
  composerRootRef,
  ariaLabel,
  onDismiss,
  children,
  contentClassName,
}: ComposerSuggestionDropdownProps) {
  const [mounted, setMounted] = useState(false);
  const [radixOpen, setRadixOpen] = useState(false);
  // 打开动画落位前临时压成 text 光标，避免菜单在指针下展开时闪手型；落位后恢复设置页手型/默认规则
  const [openCursorSettling, setOpenCursorSettling] = useState(false);
  const stickyAnchorRef = useRef<DOMRect | null>(null);
  const frozenChildrenRef = useRef<ReactNode>(null);

  if (active && anchor) {
    stickyAnchorRef.current = anchor;
  }
  if (active && children) {
    frozenChildrenRef.current = children;
  }

  useLayoutEffect(() => {
    if (active) {
      setMounted(true);
      setRadixOpen(true);
      return;
    }
    if (!mounted) {
      return;
    }
    setRadixOpen(false);
  }, [active, mounted]);

  useEffect(() => {
    if (!radixOpen) {
      setOpenCursorSettling(false);
      return;
    }
    setOpenCursorSettling(true);
    const timeout = window.setTimeout(() => setOpenCursorSettling(false), RADIX_OVERLAY_CLOSE_MS);
    return () => window.clearTimeout(timeout);
  }, [radixOpen]);

  // 若仍被抢到 menu（如 menuitem leave → content.focus），立刻还回 Composer
  useEffect(() => {
    if (!active || !radixOpen) {
      return;
    }
    const restoreIfStolen = () => {
      if (!isMenuFocusTarget(document.activeElement)) {
        return;
      }
      focusComposerEditable(composerRootRef.current);
    };
    restoreIfStolen();
    const frame = window.requestAnimationFrame(restoreIfStolen);
    document.addEventListener("focusin", restoreIfStolen);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("focusin", restoreIfStolen);
    };
  }, [active, composerRootRef, radixOpen]);

  useEffect(() => {
    if (active || !mounted) {
      return;
    }
    const timeout = window.setTimeout(() => setMounted(false), RADIX_OVERLAY_CLOSE_MS);
    return () => window.clearTimeout(timeout);
  }, [active, mounted]);

  const displayAnchor = anchor ?? stickyAnchorRef.current;
  const displayChildren = mounted ? frozenChildrenRef.current : null;

  if (!mounted || !displayAnchor) {
    return null;
  }

  const triggerStyle = scaleRootFixedAnchorStyle({
    left: displayAnchor.left,
    top: displayAnchor.top,
    width: Math.max(displayAnchor.width, 1),
    height: Math.max(displayAnchor.height, 1),
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      if (active) {
        return;
      }
      setRadixOpen(false);
      runAfterRadixOverlayClose(onDismiss);
      return;
    }
    setRadixOpen(true);
  };

  const preventComposerOutsideDismiss = (event: { target: EventTarget | null; preventDefault(): void }) => {
    if (isTargetWithinComposer(event.target, composerRootRef.current)) {
      event.preventDefault();
    }
  };

  return (
    <DropdownMenu open={radixOpen} onOpenChange={handleOpenChange} modal={false}>
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden
          tabIndex={-1}
          style={triggerStyle}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={8}
        aria-label={ariaLabel}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEntryFocus={(event) => {
          // 键盘打开时 Radix 默认会把焦点移到首个 menuitem；建议菜单用 Composer 快捷键导航，须阻止
          event.preventDefault();
        }}
        onPointerDownOutside={preventComposerOutsideDismiss}
        onInteractOutside={preventComposerOutsideDismiss}
        className={cn(
          DESKTOP_OVERLAY_LIST_CONTENT,
          DESKTOP_OVERLAY_LIST_WIDTH,
          openCursorSettling && "spirit-composer-suggestion-open-settle",
          contentClassName,
        )}
      >
        <ScrollArea
          type="always"
          className={DESKTOP_OVERLAY_LIST_SCROLL_AREA}
          onWheel={stopOverlayScrollPropagation}
          onTouchMove={stopOverlayScrollPropagation}
        >
          <div className={DESKTOP_OVERLAY_LIST_LIST_PADDING}>
            {displayChildren}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

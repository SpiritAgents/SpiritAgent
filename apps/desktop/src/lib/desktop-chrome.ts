import { cn } from "@/lib/utils";

/**
 * Instant hover fill — exclude background-color from transitions (session-sidebar precedent).
 * Keeps existing hover:bg-* overlays; only removes bg fade in/out on hover.
 */
export const instantHoverMotionClass =
  "!transition-[opacity,transform,box-shadow] duration-150";

/** ghost 在 aria-expanded 时默认带 bg-muted，顶栏图标按钮需全透明底 */
export const DESKTOP_CHROME_TOGGLE_ICON_BTN = cn(
  "size-7 shrink-0 bg-transparent text-foreground/90 hover:bg-foreground/[0.06] hover:text-foreground dark:hover:bg-foreground/10 aria-expanded:bg-transparent dark:aria-expanded:bg-transparent aria-expanded:text-foreground aria-expanded:hover:bg-foreground/[0.06] dark:aria-expanded:hover:bg-foreground/10 [&_svg]:size-3.5",
  instantHoverMotionClass,
);

export const DESKTOP_CHROME_COMMIT_BTN = cn(
  "h-7 rounded-md px-2 text-xs font-medium text-foreground/90 hover:bg-foreground/[0.06] hover:text-foreground dark:hover:bg-foreground/10",
  instantHoverMotionClass,
);

/** Git 更改区 primary 按钮（ButtonGroup 分段，配合 `size="xs"`）；`border-r-0` 避免透明右边框叠在分割线上显得过粗 */
export const DESKTOP_GIT_ACTION_BTN = cn(
  "border-r-0 shadow-none",
  instantHoverMotionClass,
);

/** Git ButtonGroup 中间竖线（`ButtonGroupSeparator`）；`!bg-*` 覆盖 Separator 默认的 bg-border / bg-input */
export const DESKTOP_GIT_ACTION_SPLIT = cn(
  "!my-0 !mx-0 h-auto w-px min-w-px max-w-px shrink-0 self-stretch !border-0 !bg-border-0 !bg-[var(--git-action-split)] !p-0",
);

/** Git ButtonGroup 右侧下拉触发器 */
export const DESKTOP_GIT_ACTION_MENU_TRIGGER = cn(
  DESKTOP_GIT_ACTION_BTN,
  "w-6 min-w-6 max-w-6 rounded-l-none rounded-r-md px-0",
);

/** Compact dropdown shell：关掉基类 overflow-y-auto，由内层 ScrollArea 独占滚动 */
export const DESKTOP_COMPACT_OVERLAY_CONTENT =
  "max-h-none overflow-hidden p-0 text-xs";

export const DESKTOP_COMPACT_OVERLAY_WIDTH =
  "w-max min-w-[max(10rem,var(--radix-dropdown-menu-trigger-width))] max-w-[min(18.5rem,calc(100vw-1.25rem))]";

export const DESKTOP_COMPACT_OVERLAY_SIMPLE_MENU =
  "max-h-none min-w-[10rem] overflow-hidden p-1.5 text-xs";

export const DESKTOP_COMPACT_OVERLAY_FILTER_HEADER =
  "shrink-0 border-b border-border/40 p-1.5";

export const DESKTOP_COMPACT_OVERLAY_FILTER_INPUT =
  "h-8 w-full min-w-0 text-xs";

/**
 * 列表区高度上限。Radix ScrollArea 在 `max-height` 下要求把上限直接放到 Viewport
 * （radix-ui/primitives#2307）；flex-1 + h-full 仅在父级有「固定」高度时才生效，
 * compact 面板用 max-h 自适应，故统一走「max-h 设在 viewport」的成熟方案，
 * header/footer 作为兄弟节点在 overflow-hidden 容器内自然堆叠。
 */
export const DESKTOP_COMPACT_OVERLAY_SCROLL_AREA =
  "[&>[data-radix-scroll-area-viewport]]:max-h-[min(16rem,var(--radix-dropdown-menu-content-available-height))] [&>[data-radix-scroll-area-viewport]]:overscroll-contain";

export const DESKTOP_COMPACT_OVERLAY_LIST = "p-1.5 pr-2";

export const DESKTOP_COMPACT_OVERLAY_ITEM = "px-2 py-2";

export const DESKTOP_COMPACT_OVERLAY_ITEM_PRIMARY =
  "truncate text-xs font-medium text-foreground";

export const DESKTOP_COMPACT_OVERLAY_ITEM_SECONDARY =
  "truncate text-[11px] text-muted-foreground";

export const DESKTOP_COMPACT_OVERLAY_GROUP_LABEL =
  "px-2 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground";

export const DESKTOP_COMPACT_OVERLAY_SUBCONTENT = "min-w-[10rem] text-xs";

export const DESKTOP_COMPACT_WORKSPACE_PANEL = cn(
  DESKTOP_COMPACT_OVERLAY_CONTENT,
  "w-[min(18.5rem,calc(100vw-1.25rem))]",
);

export const DESKTOP_COMPACT_ACTION_POPOVER_CONTENT =
  "w-max min-w-[10rem] max-w-[min(14.5rem,calc(100vw-1.25rem))] p-1.5";

export const DESKTOP_COMPACT_ACTION_POPOVER_HEADING =
  "px-2 py-1.5 text-[11px] font-medium text-muted-foreground";

export const DESKTOP_COMPACT_ACTION_POPOVER_ITEM = cn(
  "flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs outline-none",
  "text-foreground hover:bg-accent hover:text-accent-foreground",
  "focus-visible:bg-accent focus-visible:text-accent-foreground",
  "disabled:pointer-events-none disabled:opacity-50",
);

/** 阻止滚轮穿透到背后会话/列表 */
export function stopOverlayScrollPropagation(event: {
  stopPropagation(): void;
}): void {
  event.stopPropagation();
}

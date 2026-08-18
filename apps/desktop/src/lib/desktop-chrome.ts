import {
  DESKTOP_OVERLAY_GROUP_LABEL_CLASS,
  DESKTOP_OVERLAY_ITEM_PRIMARY_CLASS,
  DESKTOP_SIDEBAR_TEXT_CLASS,
  FONT_WEIGHT_NORMAL,
} from "@/lib/desktop-typography";
import {
  DESKTOP_OVERLAY_LIGHT_SHADOW,
  desktopComposerChipSurfaceClass,
} from "@/lib/desktop-translucency-surface";
import { cn } from "@/lib/utils";

export {
  DESKTOP_COMPOSER_SURFACE_BACKDROP,
  DESKTOP_COMPOSER_SURFACE_TRANSLUCENCY_TINT,
  DESKTOP_COMPOSER_SURFACE_SOLID,
  DESKTOP_ELEVATION_SHADOW_SM,
  DESKTOP_OVERLAY_LIGHT_SHADOW,
  desktopComposerChipSurfaceClass,
  desktopComposerSurfaceBackdropClass,
} from "@/lib/desktop-translucency-surface";

/**
 * Instant hover fill — exclude background-color from transitions (session-sidebar precedent).
 * Keeps existing hover:bg-* overlays; only removes bg fade in/out on hover.
 */
export const instantHoverMotionClass = "!transition-[opacity,transform,box-shadow] duration-150";

/** Translucent hover underlay; background-color does not participate in transitions (text color changes excluded) */
export const DESKTOP_INSTANT_HOVER_OVERLAY = cn(
  "bg-transparent hover:!bg-foreground/[0.06] focus-visible:!bg-foreground/[0.06]",
  "dark:hover:!bg-white/[0.06] dark:focus-visible:!bg-white/[0.06]",
  "aria-expanded:!bg-foreground/[0.06] dark:aria-expanded:!bg-white/[0.06]",
  instantHoverMotionClass,
  "active:!translate-y-0",
);

/** Ghost icon/compact button: sidebar-sourced translucent hover + brighter text color */
export const DESKTOP_INSTANT_HOVER_GHOST_BTN = cn(
  DESKTOP_INSTANT_HOVER_OVERLAY,
  "hover:!text-sidebar-foreground focus-visible:!text-sidebar-foreground aria-expanded:!text-sidebar-foreground",
);

/** Sidebar shell / title-bar slot width transition, consistent with SessionSidebarShell */
export const DESKTOP_SHELL_LAYOUT_TRANSITION =
  "transition-[width,margin,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none motion-reduce:duration-0";

/** Default title-bar text/icon color, aligned with the sidebar's `sidebarItemDefaultTextClass` */
export const DESKTOP_CHROME_MUTED_TEXT = "text-sidebar-action-foreground";

/** Inline session-title rename input: ghost, borderless, text color matches the sidebar/title-bar session name */
export const SESSION_TITLE_RENAME_INPUT_CLASS = cn(
  "min-w-0 rounded-none border-0 bg-transparent p-0 shadow-none outline-none ring-0 focus-visible:ring-0",
  DESKTOP_SIDEBAR_TEXT_CLASS,
  DESKTOP_CHROME_MUTED_TEXT,
);

/** Title-bar session title hover: only the text color brightens, no translucent underlay */
export const DESKTOP_SESSION_TITLE_HOVER_CLASS = cn(
  "hover:!text-sidebar-foreground focus-visible:!text-sidebar-foreground",
  instantHoverMotionClass,
);

/** Title-bar hover/focus/current-item text color, aligned with the sidebar's `sidebarItemActiveTextClass` */
export const DESKTOP_CHROME_ACTIVE_TEXT = "text-sidebar-foreground";

/** ghost defaults to bg-muted when aria-expanded; title-bar icon buttons need a fully transparent background */
export const DESKTOP_CHROME_TOGGLE_ICON_BTN = cn(
  "electron-no-drag size-7 shrink-0 bg-transparent",
  DESKTOP_CHROME_MUTED_TEXT,
  "hover:bg-foreground/[0.06] hover:text-sidebar-foreground focus-visible:bg-foreground/[0.06] focus-visible:text-sidebar-foreground",
  "dark:hover:bg-white/[0.06] dark:focus-visible:bg-white/[0.06]",
  "aria-expanded:bg-transparent dark:aria-expanded:bg-transparent aria-expanded:text-sidebar-action-foreground",
  "aria-expanded:hover:bg-foreground/[0.06] aria-expanded:hover:text-sidebar-foreground dark:aria-expanded:hover:bg-white/[0.06]",
  "[&_svg]:size-3.5",
  instantHoverMotionClass,
);

/** File-sidebar toolbar toggle icon: text color aligned with the conversation area's Thought (text-muted-foreground) */
export const DESKTOP_FILES_EXPLORER_TOOLBAR_ICON_BTN = cn(
  DESKTOP_CHROME_TOGGLE_ICON_BTN,
  "text-muted-foreground hover:text-muted-foreground focus-visible:text-muted-foreground aria-expanded:text-muted-foreground aria-pressed:text-muted-foreground",
);

export const DESKTOP_CHROME_COMMIT_BTN = cn(
  "h-7 rounded-md px-2 text-xs text-foreground/90 hover:bg-foreground/[0.06] hover:text-sidebar-foreground dark:hover:bg-foreground/10",
  FONT_WEIGHT_NORMAL,
  instantHoverMotionClass,
);

/** Primary button of the Git changes area (ButtonGroup segment, paired with `size="xs"`); `border-r-0` prevents the transparent right border from stacking on the divider and looking too thick */
export const DESKTOP_GIT_ACTION_BTN = cn("border-r-0 shadow-none", instantHoverMotionClass);

/** Middle vertical line of the Git ButtonGroup (`ButtonGroupSeparator`); `!bg-*` overrides the Separator default bg-border / bg-input */
export const DESKTOP_GIT_ACTION_SPLIT = cn(
  "!my-0 !mx-0 h-auto w-px min-w-px max-w-px shrink-0 self-stretch !border-0 !bg-border-0 !bg-[var(--git-action-split)] !p-0",
);

/** Dropdown trigger on the right side of the Git ButtonGroup */
export const DESKTOP_GIT_ACTION_MENU_TRIGGER = cn(
  DESKTOP_GIT_ACTION_BTN,
  "w-6 min-w-6 max-w-6 rounded-l-none rounded-r-md px-0",
);

/**
 * Overlay menu density: uniformly use the LIST density (text-xs / py-2), aligned with the
 * model / workspace pickers.
 * The SHORT series is kept only for local cases that still need text-sm density.
 */

/** Overlay shadow: light-mode diffuse + dark-mode keeps md */
export const DESKTOP_OVERLAY_SHADOW = cn(DESKTOP_OVERLAY_LIGHT_SHADOW, "dark:shadow-md");

/** Overlay shadow: light-mode diffuse + dark-mode keeps lg (Tooltip / Popover / HoverCard, etc.) */
export const DESKTOP_OVERLAY_SHADOW_LG = cn(DESKTOP_OVERLAY_LIGHT_SHADOW, "dark:shadow-lg");

/** Ctrl+P / Ctrl+Shift+P command palette list icons and titles: slightly muted in light mode, brightened in dark mode */
export const DESKTOP_COMMAND_PALETTE_ITEM_TONE = "opacity-70 dark:opacity-90";

/** Ctrl+P / Ctrl+Shift+P command palette list row: uniform row height so single-line titles don't look cramped */
export const DESKTOP_COMMAND_PALETTE_ITEM_CLASS = cn(
  "min-h-9 min-w-0 cursor-pointer py-2 [&>svg:last-child]:hidden",
  instantHoverMotionClass,
);

/** Short list: lightweight shell (used only in local cases) */
export const DESKTOP_OVERLAY_SHORT_SHELL = cn("rounded-lg ring-0", DESKTOP_OVERLAY_SHADOW);

export const DESKTOP_OVERLAY_SHORT_CONTENT = cn(DESKTOP_OVERLAY_SHORT_SHELL, "p-1 text-sm");

/** Dropdown primitive: short-list shell + popover face */
export const DESKTOP_OVERLAY_SHORT_DROPDOWN_SURFACE = cn(
  DESKTOP_OVERLAY_SHORT_SHELL,
  "border border-border/80 bg-popover p-1 text-sm text-popover-foreground",
);

export const DESKTOP_OVERLAY_SHORT_SUBCONTENT = cn(
  DESKTOP_OVERLAY_SHORT_DROPDOWN_SURFACE,
  "min-w-[8.5rem]",
);

export const DESKTOP_OVERLAY_SHORT_ITEM = "px-2 py-1.5 text-sm";

export const DESKTOP_OVERLAY_SHORT_LIST_PADDING = "p-1";

export const DESKTOP_OVERLAY_SHORT_LIST_GAP = "gap-0.5";

/** Only adds local business classes such as a minimum width */
export const DESKTOP_OVERLAY_SHORT_MENU_MIN_WIDTH = "min-w-[8.5rem]";

/** Long list: disable the base class overflow-y-auto so the inner ScrollArea owns scrolling exclusively */
export const DESKTOP_OVERLAY_LIST_CONTENT = "max-h-none overflow-hidden p-0 text-xs";

export const DESKTOP_OVERLAY_LIST_SHELL = cn("min-w-0 rounded-lg ring-0", DESKTOP_OVERLAY_SHADOW);

/** Dropdown primitive: long-list shell + popover face (density aligned with the model / workspace pickers) */
export const DESKTOP_OVERLAY_LIST_DROPDOWN_SURFACE = cn(
  DESKTOP_OVERLAY_LIST_SHELL,
  "border border-border/80 bg-popover p-0 text-xs text-popover-foreground backdrop-blur-sm",
);

export const DESKTOP_OVERLAY_LIST_WIDTH =
  "w-max min-w-[max(11rem,var(--radix-dropdown-menu-trigger-width))] max-w-[min(14rem,calc(100vw-1.25rem))]";

export const DESKTOP_OVERLAY_LIST_FILTER_HEADER = "shrink-0 border-b border-border/40 p-1.5";

/** Form control default border: aligned with the extension card border-border/60 (no transition; hover/focus switch instantly) */
export const DESKTOP_CONTROL_BORDER = "border border-control-border transition-none";

/** Form control hover: consistent with the extension card */
export const DESKTOP_CONTROL_BORDER_HOVER = "hover:border-border hover:bg-muted/30";

/** Mouse-click focus: keep the hover border, no ring */
export const DESKTOP_CONTROL_BORDER_FOCUSED = "focus:border-border focus:bg-muted/30";

/** Keyboard Tab focus-visible: shadcn ring (mouse clicks do not trigger focus-visible) */
export const DESKTOP_CONTROL_BORDER_FOCUS_VISIBLE =
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Select trigger: slightly smaller ring, consistent with the shadcn Select default */
export const DESKTOP_CONTROL_BORDER_FOCUS_VISIBLE_SELECT =
  "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

/** Shell: keep the border whenever an inner element has focus */
export const DESKTOP_CONTROL_BORDER_FOCUS_WITHIN =
  "focus-within:border-border focus-within:bg-muted/30";

/** Shell: ring only on inner keyboard focus-visible */
export const DESKTOP_CONTROL_BORDER_FOCUS_WITHIN_KEYBOARD =
  "focus-within:has(:focus-visible):border-ring focus-within:has(:focus-visible):ring-2 focus-within:has(:focus-visible):ring-ring/50";

/** Consistent with the PendingApprovalCard guided input: thin-border shell, inner Input without ring */
export const DESKTOP_OVERLAY_LIST_FILTER_INPUT_SHELL = cn(
  "overflow-hidden rounded-md bg-transparent",
  DESKTOP_CONTROL_BORDER,
  DESKTOP_CONTROL_BORDER_HOVER,
  DESKTOP_CONTROL_BORDER_FOCUS_WITHIN,
  DESKTOP_CONTROL_BORDER_FOCUS_WITHIN_KEYBOARD,
);

export const DESKTOP_OVERLAY_LIST_FILTER_INPUT =
  "h-7 min-h-7 w-full min-w-0 rounded-none border-0 bg-transparent px-2.5 py-1 text-xs shadow-none focus-visible:border-transparent focus-visible:ring-0";

/** ghost: transparent background consistent with popover; overrides the Input base class hover/focus bg-muted/30 (especially noticeable on light-mode focus) */
export const DESKTOP_OVERLAY_LIST_FILTER_INPUT_GHOST = cn(
  DESKTOP_OVERLAY_LIST_FILTER_INPUT,
  "rounded-md hover:!bg-transparent focus:!bg-transparent focus-visible:!bg-transparent dark:!bg-transparent",
);

/** Standard form input: consistent with the PendingApprovalCard guided input (h-8) */
export const DESKTOP_FORM_INPUT_SHELL = DESKTOP_OVERLAY_LIST_FILTER_INPUT_SHELL;

export const DESKTOP_FORM_INPUT_INNER =
  "h-8 w-full min-w-0 rounded-none border-0 bg-transparent px-2.5 py-1 text-sm shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent";

export const DESKTOP_FORM_TEXTAREA_INNER =
  "min-h-9 w-full min-w-0 flex-1 resize-none rounded-none border-0 bg-transparent px-2.5 py-2 text-sm shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent";

/** Select / custom trigger placed inside DESKTOP_FORM_INPUT_SHELL */
export const DESKTOP_FORM_FIELD_TRIGGER_INNER =
  "h-8 min-h-8 w-full rounded-none border-0 bg-transparent px-2.5 shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent";

/** Root and viewport share max-h: constraining only the viewport lets Root grow with content and distorts the h-full scrollbar track */
export const DESKTOP_OVERLAY_LIST_SCROLL_AREA =
  "max-h-[min(17rem,var(--radix-dropdown-menu-content-available-height))] [&>[data-radix-scroll-area-viewport]]:max-h-[min(17rem,var(--radix-dropdown-menu-content-available-height))] [&>[data-radix-scroll-area-viewport]]:overscroll-contain";

export const DESKTOP_OVERLAY_LIST_WORKSPACE_SCROLL_AREA =
  "min-h-0 flex-1 [&>[data-radix-scroll-area-viewport]]:h-full [&>[data-radix-scroll-area-viewport]]:overscroll-contain";

export const DESKTOP_OVERLAY_LIST_LIST_PADDING = "p-1 pr-1.5";

export const DESKTOP_OVERLAY_LIST_LIST_GAP = "gap-0.5";

export const DESKTOP_OVERLAY_LIST_GROUP_LABEL = cn(
  "px-2 py-1.5",
  DESKTOP_OVERLAY_GROUP_LABEL_CLASS,
);

/** Label embedded in a detail Popover (no extra padding; used with DESKTOP_OVERLAY_LIST_DETAIL_*) */
export const DESKTOP_OVERLAY_LIST_DETAIL_LABEL = DESKTOP_OVERLAY_GROUP_LABEL_CLASS;

export const DESKTOP_OVERLAY_LIST_ITEM = "px-2 py-1.5";

/** Long-list DropdownMenuItem primitive; shared by overlay list items such as model / workspace / approval */
export const DESKTOP_OVERLAY_LIST_DROPDOWN_ITEM =
  "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-xs outline-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50";

/** Select dropdown item: same density as DropdownMenuItem + right-side space for the ItemIndicator */
export const DESKTOP_SELECT_ITEM = cn(DESKTOP_OVERLAY_LIST_DROPDOWN_ITEM, "pr-8");

/** Select dropdown panel: same shell as Dropdown; scrolling is handled by the Radix Viewport while the outer layer stays overflow-hidden */
export const DESKTOP_SELECT_CONTENT = cn(
  DESKTOP_OVERLAY_LIST_DROPDOWN_SURFACE,
  "relative z-50 max-h-[min(24rem,var(--radix-select-content-available-height))] overflow-hidden",
);

/** Standalone bordered Select trigger (settings pages, etc.) */
export const DESKTOP_SELECT_TRIGGER = cn(
  "flex h-8 min-h-8 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-md bg-background px-2.5 py-1 text-sm outline-none",
  DESKTOP_CONTROL_BORDER,
  DESKTOP_CONTROL_BORDER_HOVER,
  DESKTOP_CONTROL_BORDER_FOCUSED,
  DESKTOP_CONTROL_BORDER_FOCUS_VISIBLE_SELECT,
  "disabled:cursor-not-allowed disabled:opacity-50",
  "data-placeholder:text-muted-foreground [&>span]:line-clamp-1",
);

export const DESKTOP_SELECT_LABEL = DESKTOP_OVERLAY_LIST_GROUP_LABEL;

/** Single-line action at the bottom of a long list (add workspace, etc.); density aligned with LIST rather than the Dropdown default SHORT */
export const DESKTOP_OVERLAY_LIST_ACTION_ITEM = "px-2 py-1.5 text-xs text-popover-foreground";

export const DESKTOP_OVERLAY_LIST_ITEM_PRIMARY = DESKTOP_OVERLAY_ITEM_PRIMARY_CLASS;

export const DESKTOP_OVERLAY_LIST_ITEM_SECONDARY = "truncate text-[11px] text-muted-foreground";

export const DESKTOP_OVERLAY_LIST_SUB_TRIGGER = "items-center gap-1.5 px-2.5 py-1.5 pr-2 text-xs";

/** Detail Popover paired with a long list: density aligned with DESKTOP_OVERLAY_LIST_* */
export const DESKTOP_OVERLAY_LIST_DETAIL_SURFACE = cn(
  DESKTOP_OVERLAY_LIST_SHELL,
  "border border-border/80 bg-popover p-0 text-xs text-popover-foreground backdrop-blur-sm",
);

export const DESKTOP_OVERLAY_LIST_DETAIL_WIDTH =
  "w-max min-w-72 max-w-[min(19rem,calc(100vw-1.25rem))]";

/** Full-height panel of the workspace picker */
export const DESKTOP_OVERLAY_LIST_WORKSPACE_PANEL =
  "flex h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] w-[min(24rem,calc(100vw-1.25rem))] max-w-[min(19rem,calc(100vw-1.25rem))] flex-col overflow-hidden p-0 text-xs";

/** Composer pill card (Changes, etc.): non-translucency glass background; for translucency use {@link desktopComposerChipSurfaceClass} */
export const DESKTOP_COMPOSER_CHIP_SURFACE = desktopComposerChipSurfaceClass(false);

/** Prevents the wheel from propagating to the conversation/list behind the overlay */
export function stopOverlayScrollPropagation(event: { stopPropagation(): void }): void {
  event.stopPropagation();
}

/** Draggable lower bound: the default width matches it, so first open is more compact */
export const SESSION_SIDEBAR_MIN_WIDTH_PX = 200;

/** Default width of the left session sidebar */
export const SESSION_SIDEBAR_DEFAULT_WIDTH_PX = SESSION_SIDEBAR_MIN_WIDTH_PX;

/** Draggable upper bound: only slightly wider than the default (do not use large viewport ratios for the right-side tool area) */
export const SESSION_SIDEBAR_MAX_WIDTH_PX = 288;

const SESSION_SIDEBAR_VIEWPORT_MAX_RATIO = 0.4;

export function computeSessionSidebarMaxWidthPx(): number {
  if (typeof window === "undefined") {
    return SESSION_SIDEBAR_MAX_WIDTH_PX;
  }
  return Math.min(
    SESSION_SIDEBAR_MAX_WIDTH_PX,
    Math.round(window.innerWidth * SESSION_SIDEBAR_VIEWPORT_MAX_RATIO),
  );
}

export function sessionSidebarShellWidth(open: boolean, widthPx: number): string {
  return open ? `calc(0.25rem + ${widthPx}px)` : "0px";
}

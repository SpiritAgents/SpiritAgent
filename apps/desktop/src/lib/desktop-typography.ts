import { cn } from "@/lib/utils";

/** Desktop 字重语义 token；数值与 Tailwind 默认一致（400 / 500 / 600） */
export const FONT_WEIGHT_NORMAL = "font-normal";
export const FONT_WEIGHT_MEDIUM = "font-medium";
export const FONT_WEIGHT_SEMIBOLD = "font-semibold";

/** 页面级主标题（设置、Automations 等） */
export const DESKTOP_PAGE_TITLE_CLASS = cn(
  "text-xl",
  FONT_WEIGHT_MEDIUM,
  "tracking-tight text-foreground",
);

/** 设置行 label */
export const DESKTOP_SETTINGS_LABEL_CLASS = cn(
  "text-sm",
  FONT_WEIGHT_NORMAL,
  "text-foreground",
);

/** 侧栏会话名、分组标签等 */
export const DESKTOP_SIDEBAR_TEXT_CLASS = cn("text-xs", FONT_WEIGHT_NORMAL);

/** 浮层列表主文本 */
export const DESKTOP_OVERLAY_ITEM_PRIMARY_CLASS = cn(
  "truncate text-xs",
  FONT_WEIGHT_NORMAL,
  "text-popover-foreground",
);

/** 浮层分组标签 */
export const DESKTOP_OVERLAY_GROUP_LABEL_CLASS = cn(
  "text-[11px]",
  FONT_WEIGHT_NORMAL,
  "tracking-wide text-muted-foreground",
);

/** 设置列表项 / 模型名等 */
export const DESKTOP_LIST_ITEM_PRIMARY_CLASS = cn(
  "text-sm",
  FONT_WEIGHT_NORMAL,
  "text-foreground",
);

/** 设置子节标题、编辑器 tab 切换 */
export const DESKTOP_SECTION_LABEL_CLASS = cn(
  "text-sm",
  FONT_WEIGHT_NORMAL,
  "text-foreground",
);

/** 紧凑型子节标题（Extensions 内嵌小节等） */
export const DESKTOP_SECTION_LABEL_COMPACT_CLASS = cn(
  "text-xs",
  FONT_WEIGHT_NORMAL,
  "text-foreground",
);

/** 菜单 / 工具栏触发器 */
export const DESKTOP_MENU_TRIGGER_TEXT_CLASS = cn("text-xs", FONT_WEIGHT_NORMAL);

/** 编辑器 tab 切换（xs） */
export const DESKTOP_EDITOR_TAB_CLASS = cn(
  "rounded-md px-2.5 text-xs",
  FONT_WEIGHT_NORMAL,
  "transition-colors",
);

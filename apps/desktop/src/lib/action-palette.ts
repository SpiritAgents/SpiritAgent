import { LOCALE_LABEL_KEYS, VALID_LANGUAGES, type ValidLanguage } from "@/lib/i18n";
import { STATIC_SLASH_COMMANDS, type SkillSlashSuggestion } from "@/lib/skill-slash";
import type { ThemePreference } from "@/lib/theme";

export type ActionPaletteTranslate = (key: string) => string;

export type ActionPaletteGroup = "session" | "mode" | "appearance";

export type ActionPaletteView = "root" | "theme" | "locale";

export const ACTION_PALETTE_GROUP_ORDER: readonly ActionPaletteGroup[] = [
  "session",
  "mode",
  "appearance",
] as const;

export const ACTION_PALETTE_GROUP_LABEL_KEYS: Record<ActionPaletteGroup, string> = {
  session: "actionPalette.group.session",
  mode: "actionPalette.group.mode",
  appearance: "actionPalette.group.appearance",
};

const THEME_OPTION_DEFS: ReadonlyArray<{ value: ThemePreference; labelKey: string }> = [
  { value: "system", labelKey: "settings.themeSystem" },
  { value: "light", labelKey: "settings.themeLight" },
  { value: "dark", labelKey: "settings.themeDark" },
];

export type NewSessionActionPaletteItem = {
  id: "action:new-session";
  kind: "new-session";
  group: "session";
  labelKey: "sidebar.newSession";
};

export type ThemeMenuActionPaletteItem = {
  id: "action:theme-menu";
  kind: "theme-menu";
  group: "appearance";
  labelKey: "actionPalette.theme";
};

export type LocaleMenuActionPaletteItem = {
  id: "action:locale-menu";
  kind: "locale-menu";
  group: "appearance";
  labelKey: "actionPalette.language";
};

export type ThemeOptionActionPaletteItem = {
  id: `action:theme:${ThemePreference}`;
  kind: "theme-option";
  value: ThemePreference;
  labelKey: string;
};

export type LocaleOptionActionPaletteItem = {
  id: `action:locale:${ValidLanguage}`;
  kind: "locale-option";
  value: ValidLanguage;
  labelKey: string;
};

export type SlashActionPaletteItem = SkillSlashSuggestion & {
  group: "session" | "mode";
};

export type ActionPaletteItem =
  | NewSessionActionPaletteItem
  | SlashActionPaletteItem
  | ThemeMenuActionPaletteItem
  | LocaleMenuActionPaletteItem
  | ThemeOptionActionPaletteItem
  | LocaleOptionActionPaletteItem;

const NEW_SESSION_ITEM: NewSessionActionPaletteItem = {
  id: "action:new-session",
  kind: "new-session",
  group: "session",
  labelKey: "sidebar.newSession",
};

const THEME_MENU_ITEM: ThemeMenuActionPaletteItem = {
  id: "action:theme-menu",
  kind: "theme-menu",
  group: "appearance",
  labelKey: "actionPalette.theme",
};

const LOCALE_MENU_ITEM: LocaleMenuActionPaletteItem = {
  id: "action:locale-menu",
  kind: "locale-menu",
  group: "appearance",
  labelKey: "actionPalette.language",
};

const MODE_SLASH_KINDS = new Set<SkillSlashSuggestion["kind"]>(["loop", "plan", "ask", "debug"]);

function slashPaletteGroup(kind: SkillSlashSuggestion["kind"]): "session" | "mode" {
  return MODE_SLASH_KINDS.has(kind) ? "mode" : "session";
}

const ROOT_ITEMS: ActionPaletteItem[] = [
  NEW_SESSION_ITEM,
  ...STATIC_SLASH_COMMANDS.map(
    (command): SlashActionPaletteItem => ({
      ...command,
      group: slashPaletteGroup(command.kind),
    }),
  ),
  THEME_MENU_ITEM,
  LOCALE_MENU_ITEM,
];

const THEME_OPTION_ITEMS: ThemeOptionActionPaletteItem[] = THEME_OPTION_DEFS.map((opt) => ({
  id: `action:theme:${opt.value}`,
  kind: "theme-option",
  value: opt.value,
  labelKey: opt.labelKey,
}));

const LOCALE_OPTION_ITEMS: LocaleOptionActionPaletteItem[] = VALID_LANGUAGES.map((lang) => ({
  id: `action:locale:${lang}`,
  kind: "locale-option",
  value: lang,
  labelKey: LOCALE_LABEL_KEYS[lang],
}));

function matchesQuery(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query.trim().toLowerCase());
}

function actionPaletteSearchText(item: ActionPaletteItem, t: ActionPaletteTranslate): string {
  if (item.kind === "new-session" || item.kind === "theme-menu" || item.kind === "locale-menu") {
    return t(item.labelKey);
  }

  if (item.kind === "theme-option" || item.kind === "locale-option") {
    return t(item.labelKey);
  }

  const parts = [item.name, item.paletteName, item.alias.slice(1)].filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );
  if (item.descriptionKey) {
    parts.push(t(item.descriptionKey));
  }
  if (item.description) {
    parts.push(item.description);
  }
  return parts.join(" ");
}

function filterByQuery(
  items: readonly ActionPaletteItem[],
  query: string,
  t: ActionPaletteTranslate,
): ActionPaletteItem[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [...items];
  }
  return items.filter((item) => matchesQuery(actionPaletteSearchText(item, t), trimmed));
}

export function buildActionPaletteItems(
  query: string,
  t: ActionPaletteTranslate,
  view: ActionPaletteView = "root",
): ActionPaletteItem[] {
  if (view === "theme") {
    return filterByQuery(THEME_OPTION_ITEMS, query, t);
  }
  if (view === "locale") {
    return filterByQuery(LOCALE_OPTION_ITEMS, query, t);
  }
  return filterByQuery(ROOT_ITEMS, query, t);
}

export function groupActionPaletteRootItems(
  items: readonly ActionPaletteItem[],
): Array<{ group: ActionPaletteGroup; items: ActionPaletteItem[] }> {
  const buckets = new Map<ActionPaletteGroup, ActionPaletteItem[]>();
  for (const group of ACTION_PALETTE_GROUP_ORDER) {
    buckets.set(group, []);
  }
  for (const item of items) {
    if (!("group" in item) || item.group == null) {
      continue;
    }
    buckets.get(item.group)?.push(item);
  }
  return ACTION_PALETTE_GROUP_ORDER.map((group) => ({
    group,
    items: buckets.get(group) ?? [],
  })).filter((entry) => entry.items.length > 0);
}

export function isNewSessionAction(item: ActionPaletteItem): item is NewSessionActionPaletteItem {
  return item.kind === "new-session";
}

export function isAppearanceMenuAction(
  item: ActionPaletteItem,
): item is ThemeMenuActionPaletteItem | LocaleMenuActionPaletteItem {
  return item.kind === "theme-menu" || item.kind === "locale-menu";
}

export function isThemeOptionAction(item: ActionPaletteItem): item is ThemeOptionActionPaletteItem {
  return item.kind === "theme-option";
}

export function isLocaleOptionAction(
  item: ActionPaletteItem,
): item is LocaleOptionActionPaletteItem {
  return item.kind === "locale-option";
}

export function isSlashActionPaletteItem(item: ActionPaletteItem): item is SlashActionPaletteItem {
  return (
    item.kind === "export-session" ||
    item.kind === "compact" ||
    item.kind === "fork" ||
    item.kind === "side-chat" ||
    item.kind === "loop" ||
    item.kind === "plan" ||
    item.kind === "ask" ||
    item.kind === "debug" ||
    item.kind === "skill"
  );
}

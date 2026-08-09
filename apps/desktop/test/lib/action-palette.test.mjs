import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ACTION_PALETTE_GROUP_ORDER,
  buildActionPaletteItems,
  groupActionPaletteRootItems,
} from "../../src/lib/action-palette.ts";
import { STATIC_SLASH_COMMANDS } from "../../src/lib/skill-slash.ts";

const EN_LABELS = {
  "sidebar.newSession": "New Session",
  "slash.createSkill": "Create or refine a SKILL.md with natural language",
  "slash.exportSession": "Export llm_history and API trace",
  "slash.compact": "Compact the current session context",
  "slash.loop": "Run autonomously until finish_task",
  "slash.plan": "Plan without editing code",
  "slash.ask": "Read-only help",
  "slash.fork": "Fork the session at the latest assistant message into a new chat",
  "actionPalette.theme": "Theme",
  "actionPalette.language": "Language",
  "settings.themeSystem": "System",
  "settings.themeLight": "Light",
  "settings.themeDark": "Dark",
  "settings.langZhCN": "Simplified Chinese",
  "settings.langEn": "English",
  "settings.langZhTW": "Traditional Chinese",
  "settings.langJa": "Japanese",
  "settings.langKo": "Korean",
  "settings.langDe": "German",
  "settings.langFr": "French",
  "settings.langEs": "Spanish",
  "settings.langPtBR": "Brazilian Portuguese",
  "settings.langRu": "Russian",
};

const ZH_LABELS = {
  "sidebar.newSession": "新会话",
  "actionPalette.theme": "主题",
  "actionPalette.language": "语言",
  "settings.themeSystem": "跟随系统",
  "settings.themeLight": "浅色",
  "settings.themeDark": "深色",
  "settings.langZhCN": "简体中文",
  "settings.langEn": "英语",
};

function tEn(key) {
  return EN_LABELS[key] ?? key;
}

function tZh(key) {
  return ZH_LABELS[key] ?? key;
}

test("buildActionPaletteItems returns grouped root items including appearance menus", () => {
  const items = buildActionPaletteItems("", tEn);
  assert.equal(items[0]?.kind, "new-session");
  assert.equal(items[0]?.group, "session");
  assert.equal(
    items.length,
    1 + STATIC_SLASH_COMMANDS.length + 2,
  );
  assert.ok(items.some((item) => item.kind === "theme-menu"));
  assert.ok(items.some((item) => item.kind === "locale-menu"));
  assert.equal(
    items.some((item) => item.kind === "skill"),
    false,
  );
  assert.equal(
    items.some((item) => "alias" in item && item.alias === "/start-implementing"),
    false,
  );

  const modeItem = items.find((item) => item.kind === "plan");
  assert.equal(modeItem?.group, "mode");
  const sessionItem = items.find((item) => item.kind === "compact");
  assert.equal(sessionItem?.group, "session");
});

test("groupActionPaletteRootItems preserves session mode appearance order", () => {
  const items = buildActionPaletteItems("", tEn);
  const grouped = groupActionPaletteRootItems(items);
  assert.deepEqual(
    grouped.map((entry) => entry.group),
    [...ACTION_PALETTE_GROUP_ORDER],
  );
  assert.ok(grouped.find((entry) => entry.group === "appearance")?.items.length === 2);
});

test("buildActionPaletteItems filters compact by prefix", () => {
  const items = buildActionPaletteItems("comp", tEn);
  assert.ok(items.some((item) => item.kind === "compact"));
  assert.equal(
    items.some((item) => item.kind === "loop"),
    false,
  );
});

test("buildActionPaletteItems matches localized new session label", () => {
  const items = buildActionPaletteItems("新会话", tZh);
  assert.ok(items.some((item) => item.kind === "new-session"));
});

test("buildActionPaletteItems matches slash description text", () => {
  const items = buildActionPaletteItems("plan without", tEn);
  assert.ok(items.some((item) => item.kind === "plan"));
});

test("buildActionPaletteItems theme view only returns theme options", () => {
  const items = buildActionPaletteItems("", tEn, "theme");
  assert.ok(items.length >= 3);
  assert.ok(items.every((item) => item.kind === "theme-option"));
  assert.equal(
    items.some((item) => item.kind === "new-session"),
    false,
  );
});

test("buildActionPaletteItems theme view filters by option label", () => {
  const items = buildActionPaletteItems("light", tEn, "theme");
  assert.equal(items.length, 1);
  assert.equal(items[0]?.kind, "theme-option");
  assert.equal(items[0]?.value, "light");
});

test("buildActionPaletteItems locale view only returns locale options", () => {
  const items = buildActionPaletteItems("", tEn, "locale");
  assert.ok(items.every((item) => item.kind === "locale-option"));
  assert.ok(items.some((item) => item.kind === "locale-option" && item.value === "en"));
});

test("buildActionPaletteItems locale view filters by language label", () => {
  const items = buildActionPaletteItems("english", tEn, "locale");
  assert.ok(items.some((item) => item.kind === "locale-option" && item.value === "en"));
  assert.equal(
    items.some((item) => item.kind === "locale-option" && item.value === "zh-CN"),
    false,
  );
});

test("buildActionPaletteItems root search matches appearance menu labels", () => {
  const items = buildActionPaletteItems("theme", tEn);
  assert.ok(items.some((item) => item.kind === "theme-menu"));
  assert.equal(
    items.some((item) => item.kind === "theme-option"),
    false,
  );
});

test("buildActionPaletteItems matches English labels under Chinese UI", () => {
  assert.ok(buildActionPaletteItems("theme", tZh).some((item) => item.kind === "theme-menu"));
  assert.ok(
    buildActionPaletteItems("new session", tZh).some((item) => item.kind === "new-session"),
  );
  assert.ok(buildActionPaletteItems("language", tZh).some((item) => item.kind === "locale-menu"));
});

test("buildActionPaletteItems theme view matches English under Chinese UI", () => {
  const items = buildActionPaletteItems("light", tZh, "theme");
  assert.equal(items.length, 1);
  assert.equal(items[0]?.kind, "theme-option");
  assert.equal(items[0]?.value, "light");
});

test("buildActionPaletteItems locale view matches English under Chinese UI", () => {
  const byLabel = buildActionPaletteItems("english", tZh, "locale");
  assert.ok(byLabel.some((item) => item.kind === "locale-option" && item.value === "en"));
  const byCode = buildActionPaletteItems("en", tZh, "locale");
  assert.ok(byCode.some((item) => item.kind === "locale-option" && item.value === "en"));
});

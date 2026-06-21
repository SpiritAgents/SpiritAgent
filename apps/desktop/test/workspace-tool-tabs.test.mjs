import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BROWSER_NEW_TAB_SENTINEL,
  addWorkspaceToolTab,
  closeWorkspaceToolTab,
  createDefaultWorkspaceToolTabs,
  createInitialWorkspaceToolsState,
  createWorkspaceToolTab,
  defaultActiveWorkspaceToolTabId,
  focusFirstTabOfKind,
  isBrowserNewTabUrl,
  normalizeWorkspaceToolTabsForHost,
  openBrowserUrlInWorkspaceTabs,
  workspaceTerminalChipDisplayName,
  workspaceToolTabLabel,
} from "../src/lib/workspace-tool-tabs.ts";

const t = (key) =>
  ({
    "workspace.files": "文件",
    "workspace.shell": "Shell",
    "workspace.browser": "浏览器",
    "workspace.prTab": "Pull Request",
    "workspace.terminalChipDefaultName": "Terminal",
  })[key] ?? key;

test("createDefaultWorkspaceToolTabs has files, shell, and git", () => {
  const tabs = createDefaultWorkspaceToolTabs();
  assert.equal(tabs.length, 3);
  const kinds = tabs.map((t) => t.kind);
  assert.deepEqual(kinds, ["files", "shell", "git"]);
  assert.ok(tabs.every((t) => typeof t.id === "string" && t.id.length > 0));
});

test("workspaceToolTabLabel numbers duplicate kinds", () => {
  const a = createWorkspaceToolTab("files");
  const b = createWorkspaceToolTab("files");
  const tabs = [a, b];
  assert.equal(workspaceToolTabLabel("files", tabs, a.id, t), "文件");
  assert.equal(workspaceToolTabLabel("files", tabs, b.id, t), "文件 2");
  assert.equal(workspaceToolTabLabel("shell", tabs, createWorkspaceToolTab("shell").id, t), "Shell");
});

test("workspaceTerminalChipDisplayName prefers tab title then default label", () => {
  const shellA = createWorkspaceToolTab("shell");
  const shellB = createWorkspaceToolTab("shell");
  shellA.tabTitle = "npm run dev";
  const tabs = [shellA, shellB];
  assert.equal(workspaceTerminalChipDisplayName(shellA, tabs, t), "npm run dev");
  assert.equal(workspaceTerminalChipDisplayName(shellB, tabs, t), "Terminal 2");
});

test("createWorkspaceToolTab browser defaults to new-tab sentinel", () => {
  const tab = createWorkspaceToolTab("browser");
  assert.equal(tab.kind, "browser");
  assert.equal(tab.browserUrl, BROWSER_NEW_TAB_SENTINEL);
  assert.equal(isBrowserNewTabUrl(tab.browserUrl), true);
});

test("addWorkspaceToolTab browser includes sentinel url", () => {
  const tabs = createDefaultWorkspaceToolTabs();
  const { tabs: next, activeId } = addWorkspaceToolTab(tabs, "browser");
  const browserTab = next.find((item) => item.id === activeId);
  assert.equal(browserTab?.kind, "browser");
  assert.equal(browserTab?.browserUrl, BROWSER_NEW_TAB_SENTINEL);
});

test("focusFirstTabOfKind returns first matching id", () => {
  const tabs = createDefaultWorkspaceToolTabs();
  const filesId = focusFirstTabOfKind(tabs, "files");
  assert.equal(filesId, tabs[0].id);
  assert.equal(focusFirstTabOfKind([], "files"), null);
});

test("addWorkspaceToolTab appends and focuses new tab", () => {
  const tabs = createDefaultWorkspaceToolTabs();
  const { tabs: next, activeId } = addWorkspaceToolTab(tabs, "shell");
  assert.equal(next.length, 4);
  assert.equal(next.at(-1)?.kind, "shell");
  assert.equal(activeId, next.at(-1)?.id);
});

test("closeWorkspaceToolTab recreates shell when last shell tab closes", () => {
  const tabs = [createWorkspaceToolTab("shell")];
  const originalShellId = tabs[0].id;
  const closed = closeWorkspaceToolTab(tabs, originalShellId, originalShellId);
  assert.equal(closed.tabs.length, 1);
  assert.equal(closed.tabs[0]?.kind, "shell");
  assert.notEqual(closed.tabs[0]?.id, originalShellId);
  assert.equal(closed.activeId, closed.tabs[0]?.id);
});

test("closeWorkspaceToolTab does not recreate optional pr tab", () => {
  const pr = createWorkspaceToolTab("pr");
  const closed = closeWorkspaceToolTab([pr], pr.id, pr.id);
  assert.equal(closed.tabs.length, 0);
  assert.equal(closed.activeId, "");
});

test("closeWorkspaceToolTab recreates kind without resetting other tabs", () => {
  const tabs = createDefaultWorkspaceToolTabs({ includeBrowser: true });
  const shellId = tabs[1].id;
  const closed = closeWorkspaceToolTab(tabs, shellId, shellId, { includeBrowser: true });
  assert.equal(closed.tabs.length, 4);
  assert.equal(closed.tabs.filter((tab) => tab.kind === "shell").length, 1);
  assert.equal(closed.tabs.filter((tab) => tab.kind === "files").length, 1);
  assert.equal(closed.tabs.filter((tab) => tab.kind === "browser").length, 1);
  assert.equal(closed.activeId, closed.tabs.find((tab) => tab.kind === "shell")?.id);
});

test("closeWorkspaceToolTab prefers left neighbor when kind still has tabs", () => {
  const files = createWorkspaceToolTab("files");
  const shell1 = createWorkspaceToolTab("shell");
  const shell2 = createWorkspaceToolTab("shell");
  const git = createWorkspaceToolTab("git");
  const tabs = [files, shell1, shell2, git];
  const closed = closeWorkspaceToolTab(tabs, shell2.id, shell2.id);
  assert.equal(closed.activeId, shell1.id);
  assert.equal(closed.tabs.filter((tab) => tab.kind === "shell").length, 1);
});

test("defaultActiveWorkspaceToolTabId prefers files", () => {
  const tabs = createDefaultWorkspaceToolTabs();
  assert.equal(defaultActiveWorkspaceToolTabId(tabs), tabs[0].id);
});

test("createDefaultWorkspaceToolTabs can include browser on Electron", () => {
  const tabs = createDefaultWorkspaceToolTabs({ includeBrowser: true });
  assert.equal(tabs.length, 4);
  assert.deepEqual(
    tabs.map((t) => t.kind),
    ["files", "shell", "git", "browser"],
  );
});

test("normalizeWorkspaceToolTabsForHost strips browser on web host", () => {
  const tabs = createDefaultWorkspaceToolTabs({ includeBrowser: true });
  const browserTab = tabs.find((t) => t.kind === "browser");
  assert.ok(browserTab);
  const normalized = normalizeWorkspaceToolTabsForHost(tabs, browserTab.id, false);
  assert.equal(normalized.tabs.some((t) => t.kind === "browser"), false);
  assert.equal(normalized.tabs.length, 3);
  assert.equal(normalized.activeId, normalized.tabs[0].id);
});

test("normalizeWorkspaceToolTabsForHost adds browser on electron host", () => {
  const tabs = createDefaultWorkspaceToolTabs();
  const normalized = normalizeWorkspaceToolTabsForHost(tabs, tabs[0].id, true);
  assert.equal(normalized.tabs.length, 4);
  assert.equal(normalized.tabs.some((t) => t.kind === "browser"), true);
});

test("addWorkspaceToolTab can append pr tab", () => {
  const tabs = createDefaultWorkspaceToolTabs();
  const { tabs: next, activeId } = addWorkspaceToolTab(tabs, "pr");
  assert.equal(next.at(-1)?.kind, "pr");
  assert.equal(activeId, next.at(-1)?.id);
});

test("normalizeWorkspaceToolTabsForHost strips pr on web host", () => {
  const tabs = [...createDefaultWorkspaceToolTabs(), createWorkspaceToolTab("pr")];
  const prTab = tabs.find((tab) => tab.kind === "pr");
  assert.ok(prTab);
  const normalized = normalizeWorkspaceToolTabsForHost(tabs, prTab.id, false, false);
  assert.equal(normalized.tabs.some((tab) => tab.kind === "pr"), false);
});

test("workspaceToolTabLabel supports pr tab", () => {
  const tab = createWorkspaceToolTab("pr");
  assert.equal(workspaceToolTabLabel("pr", [tab], tab.id, t), "Pull Request");
});

test("createInitialWorkspaceToolsState uses same tabs for active id", () => {
  const { tabs, activeTabId } = createInitialWorkspaceToolsState();
  assert.ok(tabs.some((t) => t.id === activeTabId));
  assert.equal(tabs.find((t) => t.id === activeTabId)?.kind, "files");
});

test("openBrowserUrlInWorkspaceTabs reuses untitled browser tab", () => {
  const tabs = createDefaultWorkspaceToolTabs({ includeBrowser: true });
  const browserTab = tabs.find((t) => t.kind === "browser");
  assert.ok(browserTab);
  const result = openBrowserUrlInWorkspaceTabs(tabs, "https://example.com/docs");
  assert.equal(result.tabs.filter((t) => t.kind === "browser").length, 1);
  assert.equal(result.activeId, browserTab.id);
  assert.equal(result.tabs.find((t) => t.id === browserTab.id)?.browserUrl, "https://example.com/docs");
});

test("openBrowserUrlInWorkspaceTabs creates new tab when titled browser tab exists", () => {
  const tabs = createDefaultWorkspaceToolTabs({ includeBrowser: true });
  const browserTab = tabs.find((t) => t.kind === "browser");
  assert.ok(browserTab);
  browserTab.tabTitle = "Example Docs";
  const result = openBrowserUrlInWorkspaceTabs(tabs, "https://example.com/other");
  assert.equal(result.tabs.filter((t) => t.kind === "browser").length, 2);
  assert.notEqual(result.activeId, browserTab.id);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addWorkspaceToolTab,
  closeWorkspaceToolTab,
  createDefaultWorkspaceToolTabs,
  createInitialWorkspaceToolsState,
  createWorkspaceToolTab,
  defaultActiveWorkspaceToolTabId,
  focusFirstTabOfKind,
  workspaceToolTabLabel,
} from "../src/lib/workspace-tool-tabs.ts";

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
  assert.equal(workspaceToolTabLabel("files", tabs, a.id), "文件");
  assert.equal(workspaceToolTabLabel("files", tabs, b.id), "文件 2");
  assert.equal(workspaceToolTabLabel("shell", tabs, createWorkspaceToolTab("shell").id), "Shell");
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

test("closeWorkspaceToolTab restores defaults when last tab closes", () => {
  let tabs = [createWorkspaceToolTab("shell")];
  let activeId = tabs[0].id;
  const closed = closeWorkspaceToolTab(tabs, activeId, activeId);
  tabs = closed.tabs;
  activeId = closed.activeId;
  assert.equal(tabs.length, 3);
  assert.deepEqual(
    tabs.map((t) => t.kind),
    ["files", "shell", "git"],
  );
  assert.equal(activeId, focusFirstTabOfKind(tabs, "files"));
});

test("closeWorkspaceToolTab prefers left neighbor for active tab", () => {
  const tabs = createDefaultWorkspaceToolTabs();
  const shellId = tabs[1].id;
  const closed = closeWorkspaceToolTab(tabs, shellId, shellId);
  assert.equal(closed.activeId, tabs[0].id);
  assert.equal(closed.tabs.length, 2);
});

test("defaultActiveWorkspaceToolTabId prefers files", () => {
  const tabs = createDefaultWorkspaceToolTabs();
  assert.equal(defaultActiveWorkspaceToolTabId(tabs), tabs[0].id);
});

test("createInitialWorkspaceToolsState uses same tabs for active id", () => {
  const { tabs, activeTabId } = createInitialWorkspaceToolsState();
  assert.ok(tabs.some((t) => t.id === activeTabId));
  assert.equal(tabs.find((t) => t.id === activeTabId)?.kind, "files");
});

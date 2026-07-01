import { test } from "node:test";
import assert from "node:assert/strict";

import {
  closePane,
  countPanes,
  createLeafNode,
  createSinglePaneLayout,
  findWorkspaceToolsAnchorPaneId,
  repositionPane,
  splitPaneAt,
  updateSplitRatio,
} from "../../src/lib/conversation-split-layout.ts";

test("splitPaneAt inserts a horizontal sibling", () => {
  const root = createSinglePaneLayout("a", "/sessions/a.json");
  const next = splitPaneAt(root, "a", "horizontal", createLeafNode("b", "/sessions/b.json"));
  assert.equal(countPanes(next), 2);
  assert.equal(findWorkspaceToolsAnchorPaneId(next), "b");
});

test("vertical split anchors the top pane", () => {
  const root = createSinglePaneLayout("a", "/sessions/a.json");
  const next = splitPaneAt(root, "a", "vertical", createLeafNode("b", "/sessions/b.json"));
  assert.equal(findWorkspaceToolsAnchorPaneId(next), "a");
});

test("closePane collapses back to a single leaf", () => {
  const split = splitPaneAt(
    createSinglePaneLayout("a", "/sessions/a.json"),
    "a",
    "horizontal",
    createLeafNode("b", "/sessions/b.json"),
  );
  const closed = closePane(split, "b");
  assert.ok(closed);
  assert.equal(closed?.kind, "leaf");
  assert.equal(closed.paneId, "a");
});

test("updateSplitRatio updates the matching split node", () => {
  const split = splitPaneAt(
    createSinglePaneLayout("a", "/sessions/a.json"),
    "a",
    "horizontal",
    createLeafNode("b", "/sessions/b.json"),
  );
  assert.equal(split.kind, "split");
  if (split.kind !== "split") {
    return;
  }
  const updated = updateSplitRatio(split, split.splitId, 0.7);
  assert.equal(updated.kind, "split");
  if (updated.kind !== "split") {
    return;
  }
  assert.equal(updated.ratio, 0.7);
});

test("repositionPane moves a leaf below the target", () => {
  const split = splitPaneAt(
    createSinglePaneLayout("a", "/sessions/a.json"),
    "a",
    "horizontal",
    createLeafNode("b", "/sessions/b.json"),
  );
  const moved = repositionPane(split, "b", "a", "below");
  assert.ok(moved);
  assert.equal(moved.kind, "split");
  if (moved.kind !== "split") {
    return;
  }
  assert.equal(moved.direction, "vertical");
  assert.equal(findWorkspaceToolsAnchorPaneId(moved), "a");
});

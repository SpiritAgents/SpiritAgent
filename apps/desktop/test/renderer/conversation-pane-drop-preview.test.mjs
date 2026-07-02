import assert from "node:assert/strict";
import { test } from "node:test";

import {
  effectiveRepositionZone,
  hiddenPaneDropZonesForTwoPaneDrag,
  paneDropIndicatorRect,
  paneDropZoneRect,
  visiblePaneDropZonesForDrag,
} from "../../src/lib/conversation-pane-drop-preview.ts";
import {
  createLeafNode,
  createSinglePaneLayout,
  repositionPane,
  splitPaneAt,
  swapAdjacentPanes,
} from "../../src/lib/conversation-split-layout.ts";

function rect(left, top, width, height) {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

test("hiddenPaneDropZonesForTwoPaneDrag hides right edge when source is on the right", () => {
  const target = rect(0, 0, 400, 400);
  const source = rect(420, 0, 400, 400);
  const hidden = hiddenPaneDropZonesForTwoPaneDrag(source, target);
  assert.deepEqual([...hidden].sort(), ["after", "below"]);
});

test("visiblePaneDropZonesForDrag exposes swap row for horizontal adjacency", () => {
  const target = rect(0, 0, 400, 400);
  const source = rect(420, 0, 400, 400);
  const visible = visiblePaneDropZonesForDrag({
    paneCount: 2,
    sourcePaneHost: { getBoundingClientRect: () => source },
    targetPaneHost: { getBoundingClientRect: () => target },
  });
  assert.deepEqual(visible, ["above", "swap", "below"]);
});

test("visiblePaneDropZonesForDrag exposes swap column for vertical adjacency", () => {
  const target = rect(0, 420, 400, 400);
  const source = rect(0, 0, 400, 400);
  const visible = visiblePaneDropZonesForDrag({
    paneCount: 2,
    sourcePaneHost: { getBoundingClientRect: () => source },
    targetPaneHost: { getBoundingClientRect: () => target },
  });
  assert.deepEqual(visible, ["before", "swap", "after"]);
});

test("paneDropIndicatorRect expands swap to full target pane", () => {
  const host = rect(10, 20, 400, 300);
  const visible = ["above", "swap", "below"];
  const indicator = paneDropIndicatorRect(host, "swap", visible);
  assert.deepEqual(indicator, { x: 10, y: 20, width: 400, height: 300 });
  const edge = paneDropIndicatorRect(host, "above", visible);
  assert.equal(edge.height, 120);
  assert.equal(edge.width, 400);
});

test("paneDropZoneRect keeps swap hit target in a narrow center band", () => {
  const host = rect(0, 0, 400, 400);
  const visible = ["above", "swap", "below"];
  const swapHit = paneDropZoneRect(host, "swap", visible);
  assert.equal(swapHit.height, 80);
  assert.equal(swapHit.y, 160);
  assert.equal(swapHit.width, 400);
});

test("effectiveRepositionZone maps collapsed left-right below to after", () => {
  const visible = ["before", "below"];
  assert.equal(effectiveRepositionZone("below", visible), "after");
  assert.equal(effectiveRepositionZone("before", visible), "before");
});

test("repositionPane converts vertical split to horizontal when dropping top onto bottom-right", () => {
  const split = splitPaneAt(
    createSinglePaneLayout("top", "/sessions/top.json"),
    "top",
    "vertical",
    createLeafNode("bottom", "/sessions/bottom.json"),
  );
  const visible = ["before", "swap", "after"];
  const zone = effectiveRepositionZone("after", visible);
  assert.equal(zone, "after");
  const moved = repositionPane(split, "top", "bottom", zone);
  assert.ok(moved);
  assert.equal(moved.kind, "split");
  if (moved.kind !== "split") {
    return;
  }
  assert.equal(moved.direction, "horizontal");
});

test("swapAdjacentPanes swaps horizontal siblings", () => {
  const split = splitPaneAt(
    createSinglePaneLayout("left", "/sessions/left.json"),
    "left",
    "horizontal",
    createLeafNode("right", "/sessions/right.json"),
  );
  assert.equal(split.kind, "split");
  if (split.kind !== "split") {
    return;
  }
  assert.equal(split.first.paneId, "left");
  assert.equal(split.second.paneId, "right");
  const swapped = swapAdjacentPanes(split, "right", "left");
  assert.equal(swapped.kind, "split");
  if (swapped.kind !== "split") {
    return;
  }
  assert.equal(swapped.first.paneId, "right");
  assert.equal(swapped.second.paneId, "left");
});

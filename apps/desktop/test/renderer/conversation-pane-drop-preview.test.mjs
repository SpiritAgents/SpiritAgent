import assert from "node:assert/strict";
import { test } from "node:test";

import { hiddenPaneDropZonesForTwoPaneDrag, paneDropZoneRect } from "../../src/lib/conversation-pane-drop-preview.ts";

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

test("hiddenPaneDropZonesForTwoPaneDrag hides left edge when source is on the left", () => {
  const target = rect(420, 0, 400, 400);
  const source = rect(0, 0, 400, 400);
  const hidden = hiddenPaneDropZonesForTwoPaneDrag(source, target);
  assert.deepEqual([...hidden].sort(), ["above", "before"]);
});

test("hiddenPaneDropZonesForTwoPaneDrag hides bottom edge when source is below", () => {
  const target = rect(0, 0, 400, 400);
  const source = rect(0, 420, 400, 400);
  const hidden = hiddenPaneDropZonesForTwoPaneDrag(source, target);
  assert.deepEqual([...hidden].sort(), ["before", "below"]);
});

test("hiddenPaneDropZonesForTwoPaneDrag hides top edge when source is above", () => {
  const target = rect(0, 420, 400, 400);
  const source = rect(0, 0, 400, 400);
  const hidden = hiddenPaneDropZonesForTwoPaneDrag(source, target);
  assert.deepEqual([...hidden].sort(), ["above", "after"]);
});

test("paneDropZoneRect expands top-bottom pair to full width halves", () => {
  const host = rect(0, 0, 400, 400);
  const visible = ["above", "before"];
  const above = paneDropZoneRect(host, "above", visible);
  const before = paneDropZoneRect(host, "before", visible);
  assert.equal(above.width, 400);
  assert.equal(before.width, 400);
  assert.equal(above.height, 200);
  assert.equal(before.height, 200);
  assert.equal(before.y, 200);
});

test("paneDropZoneRect expands left-right pair to full height halves", () => {
  const host = rect(0, 0, 400, 400);
  const visible = ["above", "after"];
  const above = paneDropZoneRect(host, "above", visible);
  const after = paneDropZoneRect(host, "after", visible);
  assert.equal(above.height, 400);
  assert.equal(after.height, 400);
  assert.equal(above.width, 200);
  assert.equal(after.width, 200);
  assert.equal(after.x, 200);
});

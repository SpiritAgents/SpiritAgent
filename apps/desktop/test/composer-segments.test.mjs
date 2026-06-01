import assert from "node:assert/strict";
import { test } from "node:test";

import {
  insertSegmentAtCaret,
  mergeAdjacentTextSegments,
  segmentsToMessageText,
  segmentsToPlainText,
  syncSegmentsFromExternalValue,
} from "../src/lib/composer-segment-model.ts";

const sampleAttachment = {
  id: "el-1",
  tagName: "img",
  outerHtml: '<img src="x">',
  screenshotDataUrl: "",
  pageUrl: "https://example.com",
};

test("mergeAdjacentTextSegments merges neighbors", () => {
  const merged = mergeAdjacentTextSegments([
    { kind: "text", value: "a" },
    { kind: "text", value: "b" },
    { kind: "element", attachment: sampleAttachment },
    { kind: "text", value: " c" },
  ]);
  assert.equal(merged.length, 3);
  assert.equal(merged[0]?.kind === "text" && merged[0].value, "ab");
});

test("segmentsToPlainText preserves whitespace around elements", () => {
  const segs = [
    { kind: "text", value: "hello " },
    { kind: "element", attachment: sampleAttachment },
    { kind: "text", value: " world" },
  ];
  assert.equal(segmentsToPlainText(segs), "hello  world");
});

test("segmentsToMessageText keeps document order", () => {
  const segs = [
    { kind: "text", value: "before" },
    { kind: "element", attachment: sampleAttachment },
    { kind: "text", value: "after" },
  ];
  const message = segmentsToMessageText(segs);
  assert.match(message, /^before/);
  assert.match(message, /Selected element from https:\/\/example\.com/);
  assert.match(message, /after$/);
  assert.ok(message.indexOf("before") < message.indexOf("Selected element"));
  assert.ok(message.indexOf("Selected element") < message.indexOf("after"));
});

test("insertSegmentAtCaret splits text and leaves trailing text segment", () => {
  const { segments, caret } = insertSegmentAtCaret(
    [{ kind: "text", value: "hello world" }],
    { segmentIndex: 0, offset: 5 },
    { kind: "element", attachment: sampleAttachment },
  );
  assert.deepEqual(segments, [
    { kind: "text", value: "hello" },
    { kind: "element", attachment: sampleAttachment },
    { kind: "text", value: " world" },
  ]);
  assert.equal(caret.segmentIndex, 2);
  assert.equal(caret.offset, 0);
});

test("insertSegmentAtCaret preserves whitespace-only text after chip", () => {
  const { segments } = insertSegmentAtCaret(
    [{ kind: "element", attachment: sampleAttachment }, { kind: "text", value: "" }],
    { segmentIndex: 1, offset: 0 },
    { kind: "text", value: "   " },
  );
  const textSeg = segments.find((s) => s.kind === "text");
  assert.equal(textSeg?.kind === "text" && textSeg.value, "   ");
});

test("syncSegmentsFromExternalValue clears all segments when value empty", () => {
  const synced = syncSegmentsFromExternalValue(
    [
      { kind: "text", value: "x" },
      { kind: "element", attachment: sampleAttachment },
    ],
    "",
  );
  assert.deepEqual(synced, [{ kind: "text", value: "" }]);
});

test("syncSegmentsFromExternalValue replaces text while keeping elements", () => {
  const synced = syncSegmentsFromExternalValue(
    [
      { kind: "text", value: "old" },
      { kind: "element", attachment: sampleAttachment },
    ],
    "new",
  );
  assert.deepEqual(synced, [
    { kind: "text", value: "new" },
    { kind: "element", attachment: sampleAttachment },
  ]);
});

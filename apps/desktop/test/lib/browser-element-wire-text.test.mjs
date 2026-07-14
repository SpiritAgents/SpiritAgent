import assert from "node:assert/strict";
import test from "node:test";

import {
  browserElementContextText,
  scanBrowserElementWireBlocks,
} from "../../src/lib/browser-element-wire-text.ts";
import {
  messageContentToRichSegments,
  parseMessageContentParts,
  segmentsToMessageText,
} from "../../src/lib/composer-segment-model.ts";

const sampleAttachment = {
  id: "el-1",
  tagName: "img",
  outerHtml: '<img src="x">',
  screenshotDataUrl: "",
  pageUrl: "https://example.com",
};

test("browserElementContextText serializes typed fence block", () => {
  const wire = browserElementContextText({
    pageUrl: sampleAttachment.pageUrl,
    outerHtml: sampleAttachment.outerHtml,
  });
  assert.equal(wire, '```element:https://example.com\n<img src="x">\n```');
});

test("scanBrowserElementWireBlocks parses fence format", () => {
  const wire = browserElementContextText({
    pageUrl: "http://127.0.0.1:1420/",
    outerHtml: "<svg></svg>",
  });
  const blocks = scanBrowserElementWireBlocks(wire);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]?.pageUrl, "http://127.0.0.1:1420/");
  assert.equal(blocks[0]?.outerHtml, "<svg></svg>");
});

test("segmentsToMessageText round-trips browser element chips", () => {
  const message = segmentsToMessageText([
    { kind: "element", attachment: sampleAttachment },
    { kind: "text", value: " after" },
  ]);
  const parts = parseMessageContentParts(message);
  assert.equal(parts.length, 2);
  assert.equal(parts[0]?.kind, "element");
  if (parts[0]?.kind !== "element") {
    return;
  }
  assert.equal(parts[0].url, "https://example.com");
  assert.equal(parts[0].outerHtml, '<img src="x">');

  const segments = messageContentToRichSegments(message, "rewind");
  assert.equal(segments[0]?.kind, "element");
});

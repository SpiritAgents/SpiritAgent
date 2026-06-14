import assert from "node:assert/strict";
import test from "node:test";

import {
  messageContentToRichSegments,
  parseMessageContentParts,
  segmentsToMessageText,
} from "../../src/lib/composer-segment-model.ts";
import {
  parseTerminalSnippetWireMeta,
  scanTerminalSnippetWireBlocks,
  terminalSnippetContextText,
} from "../../src/lib/terminal-snippet-wire-text.ts";

test("terminalSnippetContextText serializes terminal name, line range, and selected text", () => {
  const wire = terminalSnippetContextText({
    terminalName: "Terminal",
    lineStart: 10,
    lineEnd: 15,
    selectedText: "error: build failed\nexit code 1",
  });

  assert.match(wire, /Selected terminal output from Terminal/);
  assert.match(wire, /Terminal\tL10-15/);
  assert.match(wire, /```text\n/);
  assert.match(wire, /error: build failed/);
});

test("parseTerminalSnippetWireMeta round-trips tab-separated meta", () => {
  const parsed = parseTerminalSnippetWireMeta("npm run dev\tL3-7");
  assert.deepEqual(parsed, {
    terminalName: "npm run dev",
    lineStart: 3,
    lineEnd: 7,
  });
});

test("segmentsToMessageText and parseMessageContentParts round-trip terminal chips", () => {
  const attachment = {
    id: "term-1",
    terminalName: "Terminal",
    lineStart: 42,
    lineEnd: 44,
    selectedText: "line one\nline two",
  };
  const message = segmentsToMessageText([{ kind: "terminalSnippet", attachment }]);
  const parts = parseMessageContentParts(message);
  assert.equal(parts.length, 1);
  assert.equal(parts[0]?.kind, "terminalSnippet");
  if (parts[0]?.kind !== "terminalSnippet") {
    return;
  }
  assert.equal(parts[0].terminalName, "Terminal");
  assert.equal(parts[0].lineStart, 42);
  assert.equal(parts[0].lineEnd, 44);
  assert.equal(parts[0].selectedText, "line one\nline two");

  const segments = messageContentToRichSegments(message, "rewind");
  assert.equal(segments.length, 1);
  assert.equal(segments[0]?.kind, "terminalSnippet");
});

test("scanTerminalSnippetWireBlocks parses body containing standalone fence lines", () => {
  const body = ["before", "```", "after"].join("\n");
  const wire = terminalSnippetContextText({
    terminalName: "Terminal 2",
    lineStart: 1,
    lineEnd: 3,
    selectedText: body,
  });
  const blocks = scanTerminalSnippetWireBlocks(wire);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]?.selectedText, body);
});

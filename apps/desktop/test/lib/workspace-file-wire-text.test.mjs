import assert from "node:assert/strict";
import test from "node:test";

import {
  messageContentToRichSegments,
  parseMessageContentParts,
  segmentsToMessageText,
} from "../../src/lib/composer-segment-model.ts";
import {
  scanWorkspaceFileWireBlocks,
  workspaceFileContextText,
  WORKSPACE_FILE_WIRE_PREFIX,
} from "../../src/lib/workspace-file-wire-text.ts";

test("workspaceFileContextText serializes typed fence block", () => {
  const wire = workspaceFileContextText("src/App.tsx");
  assert.equal(wire, "```file:src/App.tsx\n\n```");
});

test("scanWorkspaceFileWireBlocks parses new and legacy formats", () => {
  const wire = workspaceFileContextText("README.md");
  const newBlocks = scanWorkspaceFileWireBlocks(wire);
  assert.equal(newBlocks.length, 1);
  assert.equal(newBlocks[0]?.path, "README.md");

  const legacy = `${WORKSPACE_FILE_WIRE_PREFIX}\`apps/cli/main.rs\``;
  const legacyBlocks = scanWorkspaceFileWireBlocks(legacy);
  assert.equal(legacyBlocks.length, 1);
  assert.equal(legacyBlocks[0]?.path, "apps/cli/main.rs");
});

test("segmentsToMessageText round-trips workspace file chips", () => {
  const message = segmentsToMessageText([
    { kind: "text", value: "fix " },
    { kind: "workspaceFile", path: "src/App.tsx" },
  ]);
  assert.match(message, /^fix \n```file:src\/App\.tsx/);
  const parts = parseMessageContentParts(message);
  assert.equal(parts.length, 2);
  assert.equal(parts[1]?.kind, "workspaceFile");
  if (parts[1]?.kind !== "workspaceFile") {
    return;
  }
  assert.equal(parts[1].path, "src/App.tsx");

  const segments = messageContentToRichSegments(message, "rewind");
  assert.equal(segments.some((segment) => segment.kind === "workspaceFile"), true);
});

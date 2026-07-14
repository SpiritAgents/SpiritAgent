import assert from "node:assert/strict";
import test from "node:test";

import {
  messageContentToRichSegments,
  parseMessageContentParts,
  segmentsToMessageText,
} from "../../src/lib/composer-segment-model.ts";
import {
  scanSkillWireBlocks,
  skillContextText,
  SKILL_WIRE_PREFIX,
} from "../../src/lib/skill-wire-text.ts";

test("skillContextText serializes typed fence block", () => {
  const wire = skillContextText("/git-commit");
  assert.equal(wire, "```skill:/git-commit\n\n```");
});

test("scanSkillWireBlocks parses new and legacy formats", () => {
  const wire = skillContextText("/git-push");
  const newBlocks = scanSkillWireBlocks(wire);
  assert.equal(newBlocks.length, 1);
  assert.equal(newBlocks[0]?.alias, "/git-push");

  const legacy = `${SKILL_WIRE_PREFIX}\`/git-commit\``;
  const legacyBlocks = scanSkillWireBlocks(legacy);
  assert.equal(legacyBlocks.length, 1);
  assert.equal(legacyBlocks[0]?.alias, "/git-commit");
});

test("segmentsToMessageText round-trips skill chips", () => {
  const message = segmentsToMessageText([
    { kind: "skill", alias: "/git-commit" },
    { kind: "text", value: " fix typo" },
  ]);
  assert.match(message, /^```skill:\/git-commit/);
  assert.match(message, /fix typo$/);
  const parts = parseMessageContentParts(message);
  assert.equal(parts.length, 2);
  assert.equal(parts[0]?.kind, "skill");
  if (parts[0]?.kind !== "skill") {
    return;
  }
  assert.equal(parts[0].alias, "/git-commit");

  const segments = messageContentToRichSegments(message, "rewind");
  assert.equal(segments.some((segment) => segment.kind === "skill"), true);
});

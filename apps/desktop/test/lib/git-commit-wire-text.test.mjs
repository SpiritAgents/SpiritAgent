import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveGitCommitSubject,
  gitCommitContextText,
  scanGitCommitWireBlocks,
} from "../../src/lib/git-commit-wire-text.ts";

test("gitCommitContextText serializes oid and full message body", () => {
  const wire = gitCommitContextText({
    oid: "abc123def456",
    subject: "feat: add chip",
    author: "Alice",
    authoredAt: "2024-01-02 10:00:00 +0000",
    fullMessage: "feat: add chip\n\nBody paragraph.",
  });

  assert.match(wire, /^```git:abc123def456\nfeat: add chip/);
  assert.match(wire, /Body paragraph\.\n```$/);
});

test("deriveGitCommitSubject reads first line from full message", () => {
  assert.equal(
    deriveGitCommitSubject("fix(desktop): example\n\n- bullet"),
    "fix(desktop): example",
  );
});

test("scanGitCommitWireBlocks parses subject containing parentheses", () => {
  const wire = gitCommitContextText({
    oid: "f4d96fad0282ed8a134ac5af73e425cef17baede",
    subject: "fix(desktop): tool-execution-finished 继承预览 suppressExpand 与 argsExcerpt",
    author: "XianYu",
    authoredAt: "2026-07-01 05:47:43 +0800",
    fullMessage:
      "fix(desktop): tool-execution-finished 继承预览 suppressExpand 与 argsExcerpt\n\n- bullet one\n- bullet two",
  });

  const blocks = scanGitCommitWireBlocks(`${wire}\n 你好`);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]?.oid, "f4d96fad0282ed8a134ac5af73e425cef17baede");
  assert.equal(
    deriveGitCommitSubject(blocks[0]?.fullMessage ?? ""),
    "fix(desktop): tool-execution-finished 继承预览 suppressExpand 与 argsExcerpt",
  );
});

test("scanGitCommitWireBlocks and message round-trip", () => {
  const wire = gitCommitContextText({
    oid: "deadbeef",
    subject: "fix: bug",
    author: "Bob",
    authoredAt: "2025-06-01 12:00:00 +0000",
    fullMessage: "fix: bug\n\nDetails here.",
  });

  const blocks = scanGitCommitWireBlocks(wire);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]?.oid, "deadbeef");
  assert.equal(blocks[0]?.fullMessage, "fix: bug\n\nDetails here.");
});

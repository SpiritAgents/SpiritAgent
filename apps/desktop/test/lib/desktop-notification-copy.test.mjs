import assert from "node:assert/strict";
import test from "node:test";

import {
  formatSessionPrefixedTitle,
  genericApprovalNotificationBody,
  shellApprovalNotificationBody,
  stripShellReasonLine,
  truncateNotificationBody,
} from "../../src/lib/desktop-notification-copy.ts";

test("formatSessionPrefixedTitle prefixes session name", () => {
  assert.equal(formatSessionPrefixedTitle("My chat", "Task completed"), "[My chat] Task completed");
  assert.equal(formatSessionPrefixedTitle("  ", "Done"), "[Session] Done");
});

test("truncateNotificationBody shortens long text", () => {
  const long = "x".repeat(300);
  assert.equal(truncateNotificationBody(long, 10).length, 10);
  assert.match(truncateNotificationBody(long, 10), /…$/u);
});

test("stripShellReasonLine removes reason header", () => {
  const prompt = "Reason: deploy\nnpm run build";
  assert.equal(stripShellReasonLine(prompt, "Reason:"), "npm run build");
});

test("shellApprovalNotificationBody includes reason and command", () => {
  const prompt = "Reason: deploy\nnpm run build";
  assert.match(shellApprovalNotificationBody(prompt, "Reason:"), /Reason: deploy/);
  assert.match(shellApprovalNotificationBody(prompt, "Reason:"), /npm run build/);
});

test("genericApprovalNotificationBody includes tool and prompt", () => {
  const body = genericApprovalNotificationBody("edit_file", "path: README.md");
  assert.match(body, /edit_file/);
  assert.match(body, /README.md/);
});

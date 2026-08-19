import assert from "node:assert/strict";
import { test } from "vitest";

import { buildParentSubagentToolResultText } from "./subagent-parent-tool-result.js";

test("buildParentSubagentToolResultText includes sessionId and sessionTranscript", () => {
  const text = buildParentSubagentToolResultText(
    'Output "Hello". Do not perform any other actions and do not modify any files.',
    "Hello",
    false,
    "subagent-1785129948357-1",
    "/data/transcripts/session-1/subagents/subagent-1785129948357-1.json",
  );
  assert.equal(
    text,
    [
      "[subagent completed]",
      'title=Output "Hello". Do not perform any other actions and do not modify any files.',
      "sessionId=subagent-1785129948357-1",
      "sessionTranscript=/data/transcripts/session-1/subagents/subagent-1785129948357-1.json",
      "final_output:",
      "Hello",
    ].join("\n"),
  );
});

test("buildParentSubagentToolResultText omits optional metadata when absent", () => {
  const text = buildParentSubagentToolResultText("Task", "done", false);
  assert.equal(text, "[subagent completed]\ntitle=Task\nfinal_output:\ndone");
});

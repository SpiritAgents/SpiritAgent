import assert from "node:assert/strict";
import test from "node:test";

import {
  finishTaskNoticePreviewFromArguments,
  finishTaskStreamingPreviewReady,
  finishTaskSummaryFromStreamingArguments,
} from "./finish-task-preview.js";

test("finishTaskStreamingPreviewReady accepts partial summary JSON", () => {
  assert.equal(finishTaskStreamingPreviewReady("finish_task", '{"summary":"conf'), true);
  assert.equal(finishTaskStreamingPreviewReady("finish_task", "{}"), false);
  assert.equal(finishTaskStreamingPreviewReady("read_file", '{"path":"/tmp/a"}'), false);
});

test("finishTaskSummaryFromStreamingArguments extracts partial summary", () => {
  assert.equal(finishTaskSummaryFromStreamingArguments('{"summary":"verified each'), "verified each");
});

test("finishTaskNoticePreviewFromArguments builds streaming notice text", () => {
  assert.equal(finishTaskNoticePreviewFromArguments('{"summary":"verified each'), "Task completed: verified each");
  assert.equal(
    finishTaskNoticePreviewFromArguments('{"summary":"verified each message."}'),
    "Task completed: verified each message..",
  );
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  isManualCompactionUiStatusText,
  MANUAL_COMPACTION_SKIPPED_STATUS,
} from "./compaction-ui-status.js";

test("isManualCompactionUiStatusText matches manual compaction UI status lines", () => {
  assert.equal(isManualCompactionUiStatusText(MANUAL_COMPACTION_SKIPPED_STATUS), true);
  assert.equal(
    isManualCompactionUiStatusText("Compaction complete: context messages 12 -> 4, merged 8 history messages."),
    true,
  );
  assert.equal(isManualCompactionUiStatusText("Compaction failed: no valid result produced"), true);
  assert.equal(isManualCompactionUiStatusText("hello"), false);
  assert.equal(isManualCompactionUiStatusText(""), false);
});

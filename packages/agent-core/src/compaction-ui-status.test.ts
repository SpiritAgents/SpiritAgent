import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isManualCompactionUiStatusText,
  MANUAL_COMPACTION_SKIPPED_STATUS_ZH,
} from './compaction-ui-status.js';

test('isManualCompactionUiStatusText matches manual compaction UI status lines', () => {
  assert.equal(isManualCompactionUiStatusText(MANUAL_COMPACTION_SKIPPED_STATUS_ZH), true);
  assert.equal(
    isManualCompactionUiStatusText('压缩完成：上下文消息 12 -> 4，已合并 8 条历史消息。'),
    true,
  );
  assert.equal(isManualCompactionUiStatusText('压缩失败: 未产生有效结果'), true);
  assert.equal(isManualCompactionUiStatusText('hello'), false);
  assert.equal(isManualCompactionUiStatusText(''), false);
});

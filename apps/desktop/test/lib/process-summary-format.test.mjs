import assert from 'node:assert/strict';
import test from 'node:test';

import { PROCESS_SUMMARY_MAX_VISIBLE_CATEGORIES } from '../../src/lib/process-summary-format.ts';

test('PROCESS_SUMMARY_MAX_VISIBLE_CATEGORIES is three', () => {
  assert.equal(PROCESS_SUMMARY_MAX_VISIBLE_CATEGORIES, 3);
});

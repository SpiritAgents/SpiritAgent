import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeApprovalLevel } from './tools.js';

test('normalizeApprovalLevel maps canonical values', () => {
  assert.equal(normalizeApprovalLevel('default'), 'default');
  assert.equal(normalizeApprovalLevel('auto-approval'), 'auto-approval');
  assert.equal(normalizeApprovalLevel('full-approval'), 'full-approval');
});

test('normalizeApprovalLevel aliases full-access to full-approval', () => {
  assert.equal(normalizeApprovalLevel('full-access'), 'full-approval');
});

test('normalizeApprovalLevel falls back unknown values to default', () => {
  assert.equal(normalizeApprovalLevel('bogus'), 'default');
  assert.equal(normalizeApprovalLevel(undefined), 'default');
});

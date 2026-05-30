import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  normalizeGeneratedWorktreeNames,
  parseGeneratedWorktreeNamingResponse,
} from '../../dist-electron/src/host/service-utils.js';

test('parseGeneratedWorktreeNamingResponse accepts valid JSON', () => {
  const parsed = parseGeneratedWorktreeNamingResponse(
    '{"worktreeName":"spirit-add-worktree-ui","branchName":"spirit/add-worktree-ui"}',
  );
  assert.deepEqual(parsed, {
    worktreeName: 'spirit-add-worktree-ui',
    branchName: 'spirit/add-worktree-ui',
  });
});

test('normalizeGeneratedWorktreeNames rejects invalid formats', () => {
  assert.throws(
    () => normalizeGeneratedWorktreeNames({
      worktreeName: 'feature/foo',
      branchName: 'spirit/add-worktree-ui',
    }),
    /worktreeName/,
  );
  assert.throws(
    () => normalizeGeneratedWorktreeNames({
      worktreeName: 'spirit-add-worktree-ui',
      branchName: 'feature/foo',
    }),
    /branchName/,
  );
});

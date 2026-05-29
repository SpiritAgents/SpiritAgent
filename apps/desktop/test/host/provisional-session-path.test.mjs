import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';

import {
  isProvisionalSessionPath,
  provisionalNewSessionPath,
  workspaceSessionKey,
} from '../../dist-electron/src/host/storage.js';

test('provisionalNewSessionPath is stable for the same workspace', () => {
  const workspaceRoot = 'D:/SpiritAgent/repo';
  assert.equal(
    provisionalNewSessionPath(workspaceRoot),
    provisionalNewSessionPath(workspaceRoot),
  );
});

test('provisionalNewSessionPath differs across workspaces', () => {
  assert.notEqual(
    provisionalNewSessionPath('D:/SpiritAgent/repo-a'),
    provisionalNewSessionPath('D:/SpiritAgent/repo-b'),
  );
});

test('isProvisionalSessionPath detects provisional chat paths only', () => {
  const provisionalPath = provisionalNewSessionPath('D:/SpiritAgent/repo');
  assert.equal(isProvisionalSessionPath(provisionalPath), true);
  assert.equal(
    isProvisionalSessionPath(path.join(path.dirname(provisionalPath), '..', 'chat-1.json')),
    false,
  );
});

test('workspaceSessionKey normalizes workspace roots consistently', () => {
  assert.equal(
    workspaceSessionKey('D:/SpiritAgent/repo'),
    workspaceSessionKey('D:\\SpiritAgent\\repo'),
  );
});

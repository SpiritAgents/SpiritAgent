import assert from 'node:assert/strict';
import test from 'node:test';

import { createToolExecutionTextOutput } from '../ports.js';
import { appendLspDiagnosticsAfterWriteIfNeeded } from './write-append.js';

test('appendLspDiagnosticsAfterWriteIfNeeded leaves non-write tools unchanged', async () => {
  const output = createToolExecutionTextOutput('ok');
  const result = await appendLspDiagnosticsAfterWriteIfNeeded(undefined, { name: 'read_file', path: 'a.ts' }, output);
  assert.equal(result.summaryText, 'ok');
});

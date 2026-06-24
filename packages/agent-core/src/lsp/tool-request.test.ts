import assert from 'node:assert/strict';
import test from 'node:test';

import { isLspDiagnosticsToolRequest, requestFromGetDiagnosticsFunctionCall } from './tool-request.js';

test('requestFromGetDiagnosticsFunctionCall parses single path', () => {
  const request = requestFromGetDiagnosticsFunctionCall(
    'get_diagnostics',
    JSON.stringify({ paths: ['src/index.ts'] }),
  );
  assert.deepEqual(request, { name: 'get_diagnostics', paths: ['src/index.ts'] });
  assert.equal(isLspDiagnosticsToolRequest(request), true);
});

test('requestFromGetDiagnosticsFunctionCall parses multiple paths', () => {
  const request = requestFromGetDiagnosticsFunctionCall(
    'get_diagnostics',
    JSON.stringify({ paths: ['src/a.ts', 'src/b.ts'] }),
  );
  assert.deepEqual(request, { name: 'get_diagnostics', paths: ['src/a.ts', 'src/b.ts'] });
});

test('requestFromGetDiagnosticsFunctionCall deduplicates paths', () => {
  const request = requestFromGetDiagnosticsFunctionCall(
    'get_diagnostics',
    JSON.stringify({ paths: ['src/a.ts', ' src/a.ts ', 'src/b.ts'] }),
  );
  assert.deepEqual(request, { name: 'get_diagnostics', paths: ['src/a.ts', 'src/b.ts'] });
});

test('requestFromGetDiagnosticsFunctionCall rejects empty paths array', () => {
  assert.throws(
    () => requestFromGetDiagnosticsFunctionCall('get_diagnostics', JSON.stringify({ paths: [] })),
    /non-empty paths array/,
  );
  assert.throws(
    () => requestFromGetDiagnosticsFunctionCall('get_diagnostics', JSON.stringify({ paths: ['', '  '] })),
    /non-empty paths array/,
  );
});

test('requestFromGetDiagnosticsFunctionCall rejects other tool names', () => {
  assert.equal(requestFromGetDiagnosticsFunctionCall('read_file', '{}'), undefined);
});

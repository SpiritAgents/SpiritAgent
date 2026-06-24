import assert from 'node:assert/strict';
import test from 'node:test';

import { executeGetDiagnostics } from './execute-diagnostics.js';
import type { LspHostServiceInstance } from '../host-bridge/lsp-host-bindings.js';

function createMockLsp(
  handler: (path: string) => Promise<{ relativePath: string; diagnostics: unknown[]; formatted: string }>,
): LspHostServiceInstance {
  return {
    enabled: true,
    probe: async () => true,
    dispose: async () => {},
    syncFromRecordedChange: async () => {},
    getDiagnosticsForPath: handler,
    readyProvidersForToolDefinitions: () => [],
  };
}

test('executeGetDiagnostics joins successful results', async () => {
  const lsp = createMockLsp(async (inputPath) => ({
    relativePath: inputPath,
    diagnostics: [],
    formatted: `No errors or warnings reported for ${inputPath}.`,
  }));
  const output = await executeGetDiagnostics(lsp, ['src/a.ts', 'src/b.ts']);
  assert.match(output, /No errors or warnings reported for src\/a\.ts\./);
  assert.match(output, /No errors or warnings reported for src\/b\.ts\./);
  assert.ok(output.includes('\n\n'));
});

test('executeGetDiagnostics continues after per-file failure', async () => {
  const lsp = createMockLsp(async (inputPath) => {
    if (inputPath === 'bad.html') {
      throw new Error('no language server is available for .html files');
    }
    return {
      relativePath: inputPath,
      diagnostics: [],
      formatted: `No errors or warnings reported for ${inputPath}.`,
    };
  });
  const output = await executeGetDiagnostics(lsp, ['src/a.ts', 'bad.html']);
  assert.match(output, /No errors or warnings reported for src\/a\.ts\./);
  assert.match(output, /Failed to get diagnostics for bad\.html: no language server is available/);
});

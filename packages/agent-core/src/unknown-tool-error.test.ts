import assert from 'node:assert/strict';
import test from 'node:test';

import {
  enrichUnknownToolError,
  toolNamesFromDefinitions,
  unknownToolErrorMessage,
} from './unknown-tool-error.js';

test('toolNamesFromDefinitions collects OpenAI function tool names', () => {
  assert.deepEqual(
    toolNamesFromDefinitions([
      { type: 'function', function: { name: 'read_file', parameters: { type: 'object' } } },
      { type: 'function', function: { name: 'grep', parameters: { type: 'object' } } },
    ]),
    ['grep', 'read_file'],
  );
});

test('unknownToolErrorMessage lists available tools dynamically', () => {
  const message = unknownToolErrorMessage('missing_tool', ['grep', 'read_file']);
  assert.match(message, /^未知工具: missing_tool。可用工具: grep, read_file$/u);
});

test('enrichUnknownToolError replaces bare unknown tool errors', () => {
  const enriched = enrichUnknownToolError(
    new Error('未知工具: missing_tool'),
    'missing_tool',
    ['read_file', 'extension__foo__bar__abcd1234'],
  );
  assert.match(enriched.message, /可用工具: .*read_file/u);
  assert.match(enriched.message, /extension__foo__bar__abcd1234/u);
});

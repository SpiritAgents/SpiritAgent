import assert from 'node:assert/strict';
import test from 'node:test';
import { moonshotFormulaSpiritUiSuppressesExpand } from '../moonshot/formula/formula-spirit-ui.js';
import { parseResponsesBuiltInToolUiFromArgumentsJson } from '../open-responses/responses-built-in-tools.js';
import {
  buildStepfunWebSearchToolPreviewArgumentsJson,
} from './stepfun-spirit-ui.js';

test('buildStepfunWebSearchToolPreviewArgumentsJson omits suppressExpand and includes output', () => {
  const argumentsJson = buildStepfunWebSearchToolPreviewArgumentsJson({
    query: 'macOS 26 Tahoe',
    status: 'completed',
    outputExcerpt: '## 1. Example result\nURL: https://example.com',
  });

  assert.equal(moonshotFormulaSpiritUiSuppressesExpand(argumentsJson), false);

  const ui = parseResponsesBuiltInToolUiFromArgumentsJson(argumentsJson);
  assert.equal(ui?.inputExcerpt, 'macOS 26 Tahoe');
  assert.match(ui?.outputExcerpt ?? '', /Example result/);
});

test('buildStepfunWebSearchToolPreviewArgumentsJson truncates long output excerpts', () => {
  const argumentsJson = buildStepfunWebSearchToolPreviewArgumentsJson({
    query: 'long output',
    status: 'completed',
    outputExcerpt: 'x'.repeat(5_000),
  });

  const ui = parseResponsesBuiltInToolUiFromArgumentsJson(argumentsJson);
  assert.equal(ui?.outputExcerpt?.length, 4_001);
  assert.ok(ui?.outputExcerpt?.endsWith('…'));
});

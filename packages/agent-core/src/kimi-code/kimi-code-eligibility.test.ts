import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isKimiCodeManagedWebSearchToolCall,
  shouldUseKimiCodeWebSearch,
} from './kimi-code-eligibility.js';
import { buildKimiCodeWebSearchToolDefinition } from './kimi-code-web-search-tool.js';

test('shouldUseKimiCodeWebSearch matches kimi-code vendor and api base', () => {
  assert.equal(
    shouldUseKimiCodeWebSearch({
      apiKey: 'k',
      model: 'kimi-for-coding',
      llmVendor: 'kimi-code',
    }),
    true,
  );
  assert.equal(
    shouldUseKimiCodeWebSearch({
      transportKind: 'openai-compatible',
      apiKey: 'k',
      model: 'kimi-for-coding',
      baseUrl: 'https://api.kimi.com/coding/v1',
    }),
    true,
  );
  assert.equal(
    shouldUseKimiCodeWebSearch({
      transportKind: 'openai-compatible',
      apiKey: 'k',
      model: 'kimi-k2.5',
      llmVendor: 'moonshot-ai',
    }),
    false,
  );
  assert.equal(
    shouldUseKimiCodeWebSearch({
      transportKind: 'openai-compatible',
      apiKey: 'k',
      model: 'kimi-k2.5',
      llmVendor: 'moonshot-ai',
      baseUrl: 'https://api.kimi.com/coding/v1',
    }),
    false,
  );
});

test('isKimiCodeManagedWebSearchToolCall matches web_search only when eligible', () => {
  const config = {
    apiKey: 'k',
    model: 'kimi-for-coding',
    llmVendor: 'kimi-code' as const,
  };
  assert.equal(isKimiCodeManagedWebSearchToolCall('web_search', config), true);
  assert.equal(isKimiCodeManagedWebSearchToolCall('read_file', config), false);
});

test('buildKimiCodeWebSearchToolDefinition exposes query without n', () => {
  const definition = buildKimiCodeWebSearchToolDefinition() as {
    function: { name: string; parameters: { properties: Record<string, unknown>; required: string[] } };
  };
  assert.equal(definition.function.name, 'web_search');
  assert.deepEqual(definition.function.parameters.required, ['query']);
  assert.ok(definition.function.parameters.properties.query);
  assert.equal(definition.function.parameters.properties.n, undefined);
});

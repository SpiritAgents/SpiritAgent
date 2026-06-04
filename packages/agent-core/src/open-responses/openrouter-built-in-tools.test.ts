import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildOpenRouterChatCompletionsPlugins,
  buildOpenRouterResponsesBuiltInTools,
  mergeOpenRouterChatCompletionsPlugins,
  mergeOpenRouterResponsesBuiltInTools,
  shouldUseOpenRouterBuiltInTools,
  shouldUseOpenRouterChatCompletionsBuiltInTools,
  shouldUseOpenRouterResponsesBuiltInTools,
} from './openrouter-built-in-tools.js';

test('shouldUseOpenRouterBuiltInTools for openrouter chat and responses', () => {
  assert.equal(
    shouldUseOpenRouterBuiltInTools({
      apiKey: 'k',
      model: 'openai/gpt-5.1',
      llmVendor: 'openrouter',
    }),
    true,
  );
  assert.equal(
    shouldUseOpenRouterBuiltInTools({
      transportKind: 'open-responses',
      apiKey: 'k',
      model: 'openai/gpt-5.1',
      llmVendor: 'openrouter',
    }),
    true,
  );
  assert.equal(
    shouldUseOpenRouterBuiltInTools({
      apiKey: 'k',
      model: 'gpt-4.1',
      llmVendor: 'openai',
    }),
    false,
  );
});

test('shouldUseOpenRouterChatCompletionsBuiltInTools only for openrouter chat transport', () => {
  assert.equal(
    shouldUseOpenRouterChatCompletionsBuiltInTools({
      apiKey: 'k',
      model: 'openai/gpt-5.1',
      llmVendor: 'openrouter',
    }),
    true,
  );
  assert.equal(
    shouldUseOpenRouterChatCompletionsBuiltInTools({
      transportKind: 'open-responses',
      apiKey: 'k',
      model: 'openai/gpt-5.1',
      llmVendor: 'openrouter',
    }),
    false,
  );
});

test('shouldUseOpenRouterResponsesBuiltInTools only for open-responses openrouter', () => {
  assert.equal(
    shouldUseOpenRouterResponsesBuiltInTools({
      transportKind: 'open-responses',
      apiKey: 'k',
      model: 'openai/gpt-5.1',
      llmVendor: 'openrouter',
    }),
    true,
  );
  assert.equal(
    shouldUseOpenRouterResponsesBuiltInTools({
      apiKey: 'k',
      model: 'openai/gpt-5.1',
      llmVendor: 'openrouter',
    }),
    false,
  );
});

test('buildOpenRouterChatCompletionsPlugins returns web plugin', () => {
  assert.deepEqual(buildOpenRouterChatCompletionsPlugins(), [{ id: 'web' }]);
});

test('buildOpenRouterResponsesBuiltInTools returns web_search only', () => {
  const tools = buildOpenRouterResponsesBuiltInTools();
  assert.equal(tools.length, 1);
  assert.deepEqual(tools[0], { type: 'web_search' });
});

test('mergeOpenRouterResponsesBuiltInTools does not duplicate web_search', () => {
  const merged = mergeOpenRouterResponsesBuiltInTools([
    { type: 'function', function: { name: 'grep', parameters: {} } },
    { type: 'web_search' },
  ]);
  const types = merged
    .map((tool) =>
      typeof tool === 'object' && tool !== null && !Array.isArray(tool)
        ? (tool as { type?: string }).type
        : undefined,
    )
    .filter((type): type is string => typeof type === 'string');
  assert.equal(types.filter((type) => type === 'web_search').length, 1);
  assert.ok(types.includes('function'));
});

test('mergeOpenRouterChatCompletionsPlugins does not duplicate web', () => {
  const merged = mergeOpenRouterChatCompletionsPlugins([{ id: 'web' }]);
  const ids = merged
    .map((plugin) =>
      typeof plugin === 'object' && plugin !== null && !Array.isArray(plugin)
        ? (plugin as { id?: string }).id
        : undefined,
    )
    .filter((id): id is string => typeof id === 'string');
  assert.equal(ids.filter((id) => id === 'web').length, 1);
});

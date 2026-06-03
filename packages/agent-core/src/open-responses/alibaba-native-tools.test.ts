import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAlibabaChatCompletionsExtraBody,
  buildAlibabaResponsesBuiltinTools,
  mergeAlibabaResponsesBuiltinTools,
  shouldUseAlibabaChatCompletionsNativeTools,
  shouldUseAlibabaNativeTools,
  shouldUseAlibabaResponsesNativeTools,
} from './alibaba-native-tools.js';

test('shouldUseAlibabaNativeTools for alibaba chat and responses', () => {
  assert.equal(
    shouldUseAlibabaNativeTools({
      apiKey: 'k',
      model: 'qwen3-max',
      llmVendor: 'alibaba',
    }),
    true,
  );
  assert.equal(
    shouldUseAlibabaNativeTools({
      transportKind: 'open-responses',
      apiKey: 'k',
      model: 'qwen3-max',
      llmVendor: 'alibaba',
    }),
    true,
  );
  assert.equal(
    shouldUseAlibabaNativeTools({
      apiKey: 'k',
      model: 'gpt-4.1',
      llmVendor: 'openai',
    }),
    false,
  );
});

test('shouldUseAlibabaChatCompletionsNativeTools only for alibaba chat transport', () => {
  assert.equal(
    shouldUseAlibabaChatCompletionsNativeTools({
      apiKey: 'k',
      model: 'qwen3-max',
      llmVendor: 'alibaba',
    }),
    true,
  );
  assert.equal(
    shouldUseAlibabaChatCompletionsNativeTools({
      transportKind: 'open-responses',
      apiKey: 'k',
      model: 'qwen3-max',
      llmVendor: 'alibaba',
    }),
    false,
  );
});

test('buildAlibabaChatCompletionsExtraBody search-only when not streaming', () => {
  assert.deepEqual(buildAlibabaChatCompletionsExtraBody({ streaming: false }), {
    enable_search: true,
  });
});

test('shouldUseAlibabaResponsesNativeTools only for open-responses alibaba', () => {
  assert.equal(
    shouldUseAlibabaResponsesNativeTools({
      transportKind: 'open-responses',
      apiKey: 'k',
      model: 'qwen3-max',
      llmVendor: 'alibaba',
    }),
    true,
  );
  assert.equal(
    shouldUseAlibabaResponsesNativeTools({
      apiKey: 'k',
      model: 'qwen3-max',
      llmVendor: 'alibaba',
    }),
    false,
  );
});

test('buildAlibabaChatCompletionsExtraBody streaming bundle', () => {
  const body = buildAlibabaChatCompletionsExtraBody({ streaming: true });
  assert.equal(body.enable_search, true);
  assert.equal(body.enable_thinking, true);
  assert.equal(body.enable_code_interpreter, true);
  assert.deepEqual(body.search_options, { search_strategy: 'agent_max' });
});

test('buildAlibabaResponsesBuiltinTools returns two builtin types', () => {
  const tools = buildAlibabaResponsesBuiltinTools();
  assert.equal(tools.length, 2);
  assert.deepEqual(
    tools.map((tool) => tool.type),
    ['web_search', 'code_interpreter'],
  );
});

test('mergeAlibabaResponsesBuiltinTools does not duplicate', () => {
  const merged = mergeAlibabaResponsesBuiltinTools([
    { type: 'function', function: { name: 'grep', parameters: {} } },
    { type: 'web_search' },
  ]);
  const types = merged
    .map((tool) => (typeof tool === 'object' && tool !== null && !Array.isArray(tool)
      ? (tool as { type?: string }).type
      : undefined))
    .filter((type): type is string => typeof type === 'string');
  assert.equal(types.filter((type) => type === 'web_search').length, 1);
  assert.ok(types.includes('code_interpreter'));
  assert.ok(types.includes('function'));
});

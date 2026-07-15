import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAnthropicProviderOptions,
  resolveAnthropicThinkingConfig,
} from './anthropic-compat.js';

test('resolveAnthropicThinkingConfig disables thinking for known unsupported metadata', () => {
  assert.deepEqual(
    resolveAnthropicThinkingConfig({
      model: 'claude-3-haiku-20240307',
      supportedEfforts: [],
    }),
    { type: 'disabled' },
  );
});

test('resolveAnthropicThinkingConfig enables thinking when effort is explicitly selected', () => {
  assert.deepEqual(
    resolveAnthropicThinkingConfig({
      model: 'claude-future-reasoner',
      effort: 'max',
    }),
    { type: 'enabled', budgetTokens: 12_000 },
  );
});

test('resolveAnthropicThinkingConfig keeps known adaptive defaults', () => {
  assert.deepEqual(
    resolveAnthropicThinkingConfig({
      model: 'claude-opus-4-7',
    }),
    { type: 'adaptive', display: 'summarized' },
  );
});

test('resolveAnthropicThinkingConfig keeps Claude 5 generation adaptive defaults', () => {
  assert.deepEqual(
    resolveAnthropicThinkingConfig({
      model: 'claude-fable-5',
    }),
    { type: 'adaptive', display: 'summarized' },
  );
  assert.deepEqual(
    resolveAnthropicThinkingConfig({
      model: 'claude-sonnet-5',
    }),
    { type: 'adaptive' },
  );
});

test('resolveAnthropicThinkingConfig leaves unknown models undefined', () => {
  assert.equal(
    resolveAnthropicThinkingConfig({
      model: 'custom-anthropic-compatible-model',
    }),
    undefined,
  );
});

test('resolveAnthropicThinkingConfig disables thinking for code-completion profile', () => {
  assert.deepEqual(
    resolveAnthropicThinkingConfig({
      model: 'claude-sonnet-4-6',
      transportRequestProfile: 'code-completion',
    }),
    { type: 'disabled' },
  );
});

test('resolveAnthropicThinkingConfig prefers explicit thinking over code-completion default', () => {
  assert.deepEqual(
    resolveAnthropicThinkingConfig({
      model: 'claude-sonnet-4-6',
      transportRequestProfile: 'code-completion',
      thinking: { type: 'enabled', budgetTokens: 1024 },
    }),
    { type: 'enabled', budgetTokens: 1024 },
  );
});

test('buildAnthropicProviderOptions emits disabled thinking for code-completion profile', () => {
  assert.deepEqual(
    buildAnthropicProviderOptions({
      model: 'claude-sonnet-4-6',
      transportRequestProfile: 'code-completion',
    }),
    {
      anthropic: {
        thinking: { type: 'disabled' },
        toolStreaming: true,
      },
    },
  );
});

test('buildAnthropicProviderOptions emits disabled thinking for unsupported models', () => {
  assert.deepEqual(
    buildAnthropicProviderOptions({
      model: 'claude-3-haiku-20240307',
      supportedEfforts: [],
    }),
    {
      anthropic: {
        thinking: { type: 'disabled' },
        toolStreaming: true,
      },
    },
  );
});

test('buildAnthropicProviderOptions omits thinking for unknown models', () => {
  assert.deepEqual(
    buildAnthropicProviderOptions({
      model: 'custom-anthropic-compatible-model',
    }),
    {
      anthropic: {
        toolStreaming: true,
      },
    },
  );
});

test('buildAnthropicProviderOptions omits anthropic thinking for meituan switch models', () => {
  assert.deepEqual(
    buildAnthropicProviderOptions({
      model: 'LongCat-2.0',
      llmVendor: 'meituan',
      supportsThinkingSwitch: true,
      effort: 'high',
    }),
    {
      anthropic: {
        effort: 'high',
        toolStreaming: true,
      },
    },
  );
});
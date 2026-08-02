import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAiSdkProviderOptionsForTests } from './ai-sdk-transport.js';

test('buildAiSdkProviderOptions maps GPT-OSS medium to groq.reasoningEffort', () => {
  assert.deepEqual(
    buildAiSdkProviderOptionsForTests({
      apiKey: 'test-key',
      model: 'openai/gpt-oss-20b',
      baseUrl: 'https://api.groq.com/openai/v1',
      llmVendor: 'groq',
      reasoningEffort: 'medium',
      workspaceRoot: process.cwd(),
    }),
    {
      groq: {
        reasoningEffort: 'medium',
      },
    },
  );
});

test('buildAiSdkProviderOptions maps Qwen default to groq.reasoningEffort explicitly', () => {
  assert.deepEqual(
    buildAiSdkProviderOptionsForTests({
      apiKey: 'test-key',
      model: 'qwen/qwen3.6-27b',
      baseUrl: 'https://api.groq.com/openai/v1',
      llmVendor: 'groq',
      reasoningEffort: 'default',
      workspaceRoot: process.cwd(),
    }),
    {
      groq: {
        reasoningEffort: 'default',
      },
    },
  );
});

test('buildAiSdkProviderOptions omits groq providerOptions for non-reasoning models', () => {
  assert.deepEqual(
    buildAiSdkProviderOptionsForTests({
      apiKey: 'test-key',
      model: 'llama-3.3-70b-versatile',
      baseUrl: 'https://api.groq.com/openai/v1',
      llmVendor: 'groq',
      workspaceRoot: process.cwd(),
    }),
    {},
  );
});

test('buildAiSdkProviderOptions omits groq providerOptions when reasoning effort unset', () => {
  assert.deepEqual(
    buildAiSdkProviderOptionsForTests({
      apiKey: 'test-key',
      model: 'openai/gpt-oss-20b',
      baseUrl: 'https://api.groq.com/openai/v1',
      llmVendor: 'groq',
      workspaceRoot: process.cwd(),
    }),
    {},
  );
});

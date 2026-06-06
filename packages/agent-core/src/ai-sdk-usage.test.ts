import assert from 'node:assert/strict';
import test from 'node:test';

import { readAiSdkUsage } from './ai-sdk-usage.js';

test('readAiSdkUsage normalizes AI SDK camelCase usage', async () => {
  const usage = await readAiSdkUsage({
    usage: {
      inputTokens: 1200,
      outputTokens: 48,
      totalTokens: 1248,
      reasoningTokens: 12,
      cachedInputTokens: 256,
    },
  });

  assert.deepEqual(usage, {
    inputTokens: 1200,
    outputTokens: 48,
    totalTokens: 1248,
    reasoningTokens: 12,
    cachedInputTokens: 256,
  });
});

test('readAiSdkUsage normalizes provider snake_case usage', async () => {
  const usage = await readAiSdkUsage({
    usage: Promise.resolve({
      prompt_tokens: 900,
      completion_tokens: 100,
      total_tokens: 1000,
    }),
  });

  assert.deepEqual(usage, {
    inputTokens: 900,
    outputTokens: 100,
    totalTokens: 1000,
  });
});

test('readAiSdkUsage prefers totalUsage over usage', async () => {
  const usage = await readAiSdkUsage({
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    totalUsage: { inputTokens: 42, outputTokens: 7, totalTokens: 49 },
  });

  assert.deepEqual(usage, {
    inputTokens: 42,
    outputTokens: 7,
    totalTokens: 49,
  });
});

test('readAiSdkUsage returns undefined when usage is missing', async () => {
  assert.equal(await readAiSdkUsage({}), undefined);
});

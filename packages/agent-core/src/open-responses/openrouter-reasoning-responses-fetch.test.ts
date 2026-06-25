import assert from 'node:assert/strict';
import test from 'node:test';

import { createOpenRouterReasoningAwareFetch } from './openrouter-reasoning-responses-fetch.js';

test('createOpenRouterReasoningAwareFetch patches openrouter claude responses body', async () => {
  let capturedBody: unknown;
  const fetchFn = createOpenRouterReasoningAwareFetch(
    {
      transportKind: 'open-responses',
      apiKey: 'test-key',
      model: 'anthropic/claude-sonnet-4.6',
      llmVendor: 'openrouter',
      reasoningEffort: 'high',
    },
    async (_input, init) => {
      capturedBody = init?.body ? JSON.parse(String(init.body)) : undefined;
      return new Response('{}', { status: 200 });
    },
  );

  await fetchFn('https://openrouter.ai/api/v1/responses', {
    method: 'POST',
    body: JSON.stringify({ model: 'anthropic/claude-sonnet-4.6', input: [] }),
  });

  assert.deepEqual(capturedBody, {
    model: 'anthropic/claude-sonnet-4.6',
    input: [],
    reasoning: { enabled: true, effort: 'high' },
  });
});

test('createOpenRouterReasoningAwareFetch is noop for non-claude openrouter models', async () => {
  let capturedBody: unknown;
  const fetchFn = createOpenRouterReasoningAwareFetch(
    {
      transportKind: 'open-responses',
      apiKey: 'test-key',
      model: 'openai/gpt-5',
      llmVendor: 'openrouter',
      reasoningEffort: 'medium',
    },
    async (_input, init) => {
      capturedBody = init?.body ? JSON.parse(String(init.body)) : undefined;
      return new Response('{}', { status: 200 });
    },
  );

  await fetchFn('https://openrouter.ai/api/v1/responses', {
    method: 'POST',
    body: JSON.stringify({ model: 'openai/gpt-5', input: [] }),
  });

  assert.deepEqual(capturedBody, {
    model: 'openai/gpt-5',
    input: [],
  });
});

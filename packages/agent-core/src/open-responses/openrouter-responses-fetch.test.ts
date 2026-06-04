import assert from 'node:assert/strict';
import test from 'node:test';

import { createOpenRouterResponsesAwareFetch } from './openrouter-responses-fetch.js';
import type { OpenResponsesTransportConfig } from './responses-compat.js';

const openrouterResponsesConfig: OpenResponsesTransportConfig = {
  transportKind: 'open-responses',
  apiKey: 'test-key',
  model: 'openai/gpt-4o',
  baseUrl: 'https://openrouter.ai/api/v1',
  llmVendor: 'openrouter',
};

test('openrouter responses fetch merges web_search builtin tool', async () => {
  let capturedBody: Record<string, unknown> | undefined;
  const baseFetch: typeof fetch = async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response('{}', { status: 200 });
  };

  const fetch = createOpenRouterResponsesAwareFetch(openrouterResponsesConfig, baseFetch);
  await fetch('https://openrouter.example/v1/responses', {
    method: 'POST',
    body: JSON.stringify({
      model: 'openai/gpt-4o',
      input: [],
      tools: [{ type: 'function', name: 'demo_lookup' }],
    }),
  });

  const tools = capturedBody?.tools as Array<{ type?: string }> | undefined;
  assert.ok(tools?.some((tool) => tool.type === 'web_search'));
  assert.ok(tools?.some((tool) => tool.type === 'function'));
});

test('openrouter responses fetch does not duplicate web_search', async () => {
  let capturedBody: Record<string, unknown> | undefined;
  const baseFetch: typeof fetch = async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response('{}', { status: 200 });
  };

  const fetch = createOpenRouterResponsesAwareFetch(openrouterResponsesConfig, baseFetch);
  await fetch('https://openrouter.example/v1/responses', {
    method: 'POST',
    body: JSON.stringify({
      model: 'openai/gpt-4o',
      input: [],
      tools: [{ type: 'web_search' }],
    }),
  });

  const tools = capturedBody?.tools as Array<{ type?: string }> | undefined;
  assert.equal(tools?.filter((tool) => tool.type === 'web_search').length, 1);
});

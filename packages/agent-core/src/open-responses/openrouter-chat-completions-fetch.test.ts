import assert from 'node:assert/strict';
import test from 'node:test';

import { createOpenRouterChatCompletionsAwareFetch } from './openrouter-chat-completions-fetch.js';
import type { OpenAiTransportConfig } from '../openai/openai-compat.js';

const openrouterChatConfig: OpenAiTransportConfig = {
  apiKey: 'test-key',
  model: 'openai/gpt-4o',
  baseUrl: 'https://openrouter.ai/api/v1',
  llmVendor: 'openrouter',
};

test('openrouter chat fetch merges web plugin on chat completions', async () => {
  let capturedBody: Record<string, unknown> | undefined;
  const baseFetch: typeof fetch = async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response('{}', { status: 200 });
  };

  const fetch = createOpenRouterChatCompletionsAwareFetch(openrouterChatConfig, baseFetch);
  await fetch('https://openrouter.example/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: 'openai/gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
    }),
  });

  const plugins = capturedBody?.plugins as Array<{ id?: string }> | undefined;
  assert.ok(plugins?.some((plugin) => plugin.id === 'web'));
});

test('openrouter chat fetch does not patch non-chat endpoints', async () => {
  let capturedBody: Record<string, unknown> | undefined;
  const baseFetch: typeof fetch = async (_input, init) => {
    capturedBody = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
    return new Response('{}', { status: 200 });
  };

  const fetch = createOpenRouterChatCompletionsAwareFetch(openrouterChatConfig, baseFetch);
  await fetch('https://openrouter.example/v1/models', { method: 'GET' });

  assert.equal(capturedBody, undefined);
});

test('openrouter chat fetch does not duplicate web plugin', async () => {
  let capturedBody: Record<string, unknown> | undefined;
  const baseFetch: typeof fetch = async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response('{}', { status: 200 });
  };

  const fetch = createOpenRouterChatCompletionsAwareFetch(openrouterChatConfig, baseFetch);
  await fetch('https://openrouter.example/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: 'openai/gpt-4o',
      messages: [],
      plugins: [{ id: 'web' }],
    }),
  });

  const plugins = capturedBody?.plugins as Array<{ id?: string }> | undefined;
  assert.equal(plugins?.filter((plugin) => plugin.id === 'web').length, 1);
});

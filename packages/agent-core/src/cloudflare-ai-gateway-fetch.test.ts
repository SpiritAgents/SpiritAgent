import assert from 'node:assert/strict';
import test from 'node:test';

import { createCloudflareAiGatewayFetch, patchCloudflareAiGatewayChatCompletionsBody } from './cloudflare-ai-gateway-fetch.js';

test('createCloudflareAiGatewayFetch injects cf-aig-gateway-id header', async () => {
  let capturedHeaders: Headers | undefined;
  const baseFetch: typeof fetch = async (_input, init) => {
    capturedHeaders = new Headers(init?.headers);
    return new Response('{}', { status: 200 });
  };

  const fetchFn = createCloudflareAiGatewayFetch('my-gateway', baseFetch);
  await fetchFn('https://api.cloudflare.com/client/v4/accounts/test/ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer token' },
  });

  assert.equal(capturedHeaders?.get('cf-aig-gateway-id'), 'my-gateway');
  assert.equal(capturedHeaders?.get('Authorization'), 'Bearer token');
});

test('createCloudflareAiGatewayFetch returns base fetch when gateway id is empty', () => {
  const baseFetch: typeof fetch = async () => new Response('{}', { status: 200 });
  assert.equal(createCloudflareAiGatewayFetch('  ', baseFetch), baseFetch);
});

test('createCloudflareAiGatewayFetch sets reasoning_effort none when function tools are present', async () => {
  let capturedBody: Record<string, unknown> | undefined;
  const baseFetch: typeof fetch = async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response('{}', { status: 200 });
  };

  const fetchFn = createCloudflareAiGatewayFetch('my-gateway', baseFetch);
  await fetchFn('https://api.cloudflare.com/client/v4/accounts/test/ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-5.5',
      reasoning_effort: 'medium',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ type: 'function', function: { name: 'test', parameters: { type: 'object' } } }],
    }),
  });

  assert.equal(capturedBody?.reasoning_effort, 'none');
});

test('patchCloudflareAiGatewayChatCompletionsBody leaves body unchanged without tools', () => {
  const body = { model: 'openai/gpt-5.5', reasoning_effort: 'medium' };
  assert.equal(patchCloudflareAiGatewayChatCompletionsBody(body), body);
});

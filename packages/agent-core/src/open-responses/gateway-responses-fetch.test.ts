import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createGatewayWebSearchAwareFetch,
  mergeGatewayResponsesWebSearchTools,
} from './gateway-responses-fetch.js';
import type { OpenResponsesTransportConfig } from './responses-compat.js';

const gatewayConfig: OpenResponsesTransportConfig = {
  transportKind: 'open-responses',
  apiKey: 'test-key',
  model: 'openai/gpt-5.4',
  llmVendor: 'vercel-ai-gateway',
};

test('mergeGatewayResponsesWebSearchTools appends provider perplexity tool once', () => {
  const merged = mergeGatewayResponsesWebSearchTools([
    { type: 'function', name: 'grep' },
  ]);
  assert.equal(merged.length, 2);
  assert.deepEqual(merged[1], {
    type: 'provider',
    id: 'gateway.perplexity_search',
    args: {},
  });
  assert.equal(mergeGatewayResponsesWebSearchTools(merged).length, 2);
});

test('createGatewayWebSearchAwareFetch injects provider tool into responses body', async () => {
  let capturedBody: Record<string, unknown> | undefined;
  const baseFetch: typeof fetch = async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response('{}', { status: 200 });
  };

  const fetchFn = createGatewayWebSearchAwareFetch(gatewayConfig, baseFetch);
  await fetchFn('http://127.0.0.1/responses', {
    method: 'POST',
    body: JSON.stringify({ model: 'gpt-5.4', tools: [{ type: 'function', name: 'grep' }] }),
  });

  const tools = capturedBody?.tools as Array<{ id?: string; type?: string }> | undefined;
  assert.ok(
    tools?.some((tool) => tool.type === 'provider' && tool.id === 'gateway.perplexity_search'),
  );
});

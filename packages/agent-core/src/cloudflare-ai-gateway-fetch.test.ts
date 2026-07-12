import assert from 'node:assert/strict';
import test from 'node:test';

import { createCloudflareAiGatewayFetch } from './cloudflare-ai-gateway-fetch.js';

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

import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveAiGatewayVideoProviderOptions } from './ai-sdk-gateway-backend.js';

test('resolveAiGatewayVideoProviderOptions omits chat /v1 baseUrl for gateway video', () => {
  const options = resolveAiGatewayVideoProviderOptions({
    apiKey: 'gateway-key',
    baseUrl: 'https://ai-gateway.vercel.sh/v1',
  });

  assert.equal(options.apiKey, 'gateway-key');
  assert.equal('baseURL' in options, false);
});

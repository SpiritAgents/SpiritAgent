import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isMinimaxH3GatewayVideoModel,
  MINIMAX_H3_GATEWAY_DEFAULT_ASPECT_RATIO,
  resolveAiGatewayVideoAspectRatio,
  resolveAiGatewayVideoProviderOptions,
} from './ai-sdk-gateway-backend.js';

test('resolveAiGatewayVideoProviderOptions omits chat /v1 baseUrl for gateway video', () => {
  const options = resolveAiGatewayVideoProviderOptions({
    apiKey: 'gateway-key',
    baseUrl: 'https://ai-gateway.vercel.sh/v1',
  });

  assert.equal(options.apiKey, 'gateway-key');
  assert.equal('baseURL' in options, false);
});

test('isMinimaxH3GatewayVideoModel matches gateway minimax h3 ids', () => {
  assert.equal(isMinimaxH3GatewayVideoModel('minimax/minimax-h3'), true);
  assert.equal(isMinimaxH3GatewayVideoModel('minimax/MiniMax-H3'), true);
  assert.equal(isMinimaxH3GatewayVideoModel('google/veo-3'), false);
});

test('resolveAiGatewayVideoAspectRatio defaults to 16:9 only for minimax h3', () => {
  assert.equal(
    resolveAiGatewayVideoAspectRatio('minimax/minimax-h3', undefined),
    MINIMAX_H3_GATEWAY_DEFAULT_ASPECT_RATIO,
  );
  assert.equal(resolveAiGatewayVideoAspectRatio('google/veo-3', undefined), undefined);
  assert.equal(resolveAiGatewayVideoAspectRatio('minimax/minimax-h3', '9:16'), '9:16');
});

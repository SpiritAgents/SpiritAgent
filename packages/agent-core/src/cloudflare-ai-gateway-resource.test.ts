import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLOUDFLARE_AI_GATEWAY_PRESET_API_BASE,
  cloudflareAiGatewayApiBaseFromAccountId,
  extractCloudflareAccountIdFromApiBase,
  isValidCloudflareAccountId,
  isValidCloudflareGatewayId,
} from './cloudflare-ai-gateway-resource.js';

test('cloudflareAiGatewayApiBaseFromAccountId builds REST API v1 base url', () => {
  assert.equal(
    cloudflareAiGatewayApiBaseFromAccountId('023e105f4ecef8ad9ca31a8372d0c353'),
    'https://api.cloudflare.com/client/v4/accounts/023e105f4ecef8ad9ca31a8372d0c353/ai/v1',
  );
  assert.equal(cloudflareAiGatewayApiBaseFromAccountId(''), CLOUDFLARE_AI_GATEWAY_PRESET_API_BASE);
});

test('extractCloudflareAccountIdFromApiBase parses account id from api base', () => {
  assert.equal(
    extractCloudflareAccountIdFromApiBase(
      'https://api.cloudflare.com/client/v4/accounts/023e105f4ecef8ad9ca31a8372d0c353/ai/v1/',
    ),
    '023e105f4ecef8ad9ca31a8372d0c353',
  );
  assert.equal(extractCloudflareAccountIdFromApiBase('https://api.openai.com/v1'), undefined);
});

test('isValidCloudflareAccountId accepts 32-char hex', () => {
  assert.equal(isValidCloudflareAccountId('023e105f4ecef8ad9ca31a8372d0c353'), true);
  assert.equal(isValidCloudflareAccountId('not-an-account-id'), false);
});

test('isValidCloudflareGatewayId accepts slug-like ids', () => {
  assert.equal(isValidCloudflareGatewayId('default'), true);
  assert.equal(isValidCloudflareGatewayId('my-gateway_1'), true);
  assert.equal(isValidCloudflareGatewayId('-bad'), false);
});

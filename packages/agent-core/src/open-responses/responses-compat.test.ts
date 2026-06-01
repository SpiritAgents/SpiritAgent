import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isGatewayOpenAiRoutedModel,
  normalizeGatewayOpenAiModelId,
  resolveOpenResponsesLanguageModelId,
  resolveOpenResponsesSdkProvider,
} from './responses-compat.js';

test('normalizeGatewayOpenAiModelId', () => {
  assert.equal(normalizeGatewayOpenAiModelId('openai/gpt-5.1'), 'gpt-5.1');
  assert.equal(normalizeGatewayOpenAiModelId('anthropic/claude-sonnet-4'), undefined);
});

test('resolveOpenResponsesSdkProvider gateway openai route uses openai sdk', () => {
  assert.equal(
    resolveOpenResponsesSdkProvider({
      llmVendor: 'vercel-ai-gateway',
      model: 'openai/gpt-5.1',
    }),
    'openai',
  );
  assert.equal(
    resolveOpenResponsesSdkProvider({
      llmVendor: 'vercel-ai-gateway',
      model: 'openai/gpt-5.1',
      responsesProvider: 'open-responses-compatible',
    }),
    'openai',
  );
});

test('resolveOpenResponsesSdkProvider gateway non-openai route stays compatible', () => {
  assert.equal(
    resolveOpenResponsesSdkProvider({
      llmVendor: 'vercel-ai-gateway',
      model: 'anthropic/claude-sonnet-4',
    }),
    'open-responses-compatible',
  );
});

test('resolveOpenResponsesLanguageModelId strips gateway openai prefix', () => {
  assert.equal(
    resolveOpenResponsesLanguageModelId({
      llmVendor: 'vercel-ai-gateway',
      model: 'openai/gpt-5.4-mini',
    }),
    'gpt-5.4-mini',
  );
  assert.equal(
    resolveOpenResponsesLanguageModelId({
      llmVendor: 'openai',
      model: 'gpt-5.1',
    }),
    'gpt-5.1',
  );
});

test('isGatewayOpenAiRoutedModel', () => {
  assert.equal(isGatewayOpenAiRoutedModel('openai/gpt-5.1'), true);
  assert.equal(isGatewayOpenAiRoutedModel('gpt-5.1'), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bedrockApiBaseFromRegion,
  normalizeAwsRegion,
  parseBedrockFoundationModelSummaries,
} from './bedrock-models.js';
import { extractAwsRegionFromBedrockApiBase } from './openai-models.js';

test('bedrock region helpers normalize and derive api base', () => {
  assert.equal(normalizeAwsRegion(' US-East-1 '), 'us-east-1');
  assert.equal(bedrockApiBaseFromRegion('eu-west-1'), 'https://bedrock.eu-west-1.amazonaws.com');
});

test('parseBedrockFoundationModelSummaries maps AWS fields without context length', () => {
  const entries = parseBedrockFoundationModelSummaries([
    {
      modelArn: 'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0',
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      modelName: 'Claude 3 Haiku',
      providerName: 'Anthropic',
      inputModalities: ['TEXT', 'IMAGE'],
      outputModalities: ['TEXT'],
      responseStreamingSupported: true,
    },
    {
      modelArn: 'arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v1',
      modelId: 'amazon.titan-embed-text-v1',
      modelName: 'Titan Embed',
      providerName: 'Amazon',
      inputModalities: ['TEXT'],
      outputModalities: ['EMBEDDING'],
    },
    {
      modelArn: 'arn:aws:bedrock:us-east-1::foundation-model/legacy.model-v1:0',
      modelId: 'legacy.model-v1:0',
      modelName: 'Legacy',
      providerName: 'Test',
      inputModalities: ['TEXT'],
      outputModalities: ['TEXT'],
      modelLifecycle: { status: 'LEGACY' },
    },
  ]);

  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.id, 'anthropic.claude-3-haiku-20240307-v1:0');
  assert.equal(entries[0]?.displayName, 'Claude 3 Haiku');
  assert.equal(entries[0]?.supportsImageInput, true);
  assert.equal(entries[0]?.supportsReasoning, true);
  assert.equal(entries[0]?.contextLength, undefined);
});

test('extractAwsRegionFromBedrockApiBase parses region from catalog cache base', () => {
  assert.equal(
    extractAwsRegionFromBedrockApiBase('https://bedrock.ap-southeast-1.amazonaws.com'),
    'ap-southeast-1',
  );
});

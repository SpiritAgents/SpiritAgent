import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hasBedrockMantleIamCredentials,
  resolveBedrockMantleOpenResponsesApiKey,
  wrapFetchForBedrockMantleIamAuth,
} from './bedrock-mantle-auth-fetch.js';

test('hasBedrockMantleIamCredentials requires region and IAM key pair', () => {
  assert.equal(
    hasBedrockMantleIamCredentials({
      region: 'us-east-2',
      accessKeyId: 'AKIA',
      secretAccessKey: 'secret',
    }),
    true,
  );
  assert.equal(
    hasBedrockMantleIamCredentials({
      region: '',
      accessKeyId: 'AKIA',
      secretAccessKey: 'secret',
    }),
    false,
  );
});

test('resolveBedrockMantleOpenResponsesApiKey prefers static bearer key', () => {
  assert.equal(
    resolveBedrockMantleOpenResponsesApiKey({
      apiKey: 'bedrock-api-key',
      bedrockMantleIam: {
        region: 'us-east-2',
        accessKeyId: 'AKIA',
        secretAccessKey: 'secret',
      },
    }),
    'bedrock-api-key',
  );
});

test('resolveBedrockMantleOpenResponsesApiKey uses IAM placeholder when bearer missing', () => {
  assert.equal(
    resolveBedrockMantleOpenResponsesApiKey({
      apiKey: '',
      bedrockMantleIam: {
        region: 'us-east-2',
        accessKeyId: 'AKIA',
        secretAccessKey: 'secret',
      },
    }),
    'bedrock-mantle-iam',
  );
});

test('wrapFetchForBedrockMantleIamAuth leaves fetch unchanged when bearer key is set', () => {
  const baseFetch = globalThis.fetch;
  assert.equal(
    wrapFetchForBedrockMantleIamAuth(
      {
        apiKey: 'bedrock-api-key',
        bedrockMantleIam: {
          region: 'us-east-2',
          accessKeyId: 'AKIA',
          secretAccessKey: 'secret',
        },
      },
      baseFetch,
    ),
    baseFetch,
  );
});

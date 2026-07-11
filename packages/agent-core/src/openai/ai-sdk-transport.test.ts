import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeGeneratedImageMarkdownRef,
} from './ai-sdk-transport.js';
import { renderAiSdkProviderError } from './ai-sdk-provider-error.js';

test('normalizeGeneratedImageMarkdownRef normalizes valid managed refs', () => {
  assert.equal(
    normalizeGeneratedImageMarkdownRef('  SPIRIT://GENERATED/image/example%20image.png  '),
    'spirit://generated/image/example%20image.png',
  );
});

test('normalizeGeneratedImageMarkdownRef rejects empty refs', () => {
  assert.throws(
    () => normalizeGeneratedImageMarkdownRef('   '),
    /empty generated image markdownRef/u,
  );
});

test('normalizeGeneratedImageMarkdownRef rejects invalid managed refs', () => {
  assert.throws(
    () => normalizeGeneratedImageMarkdownRef('spirit://generated/image/%2Fsecret.png'),
    /invalid generated image markdownRef/u,
  );
});

test('renderAiSdkProviderError reads Fireworks-style APICallError responseBody', () => {
  const error = new Error('') as Error & {
    name: string;
    statusCode: number;
    responseBody: string;
  };
  error.name = 'AI_APICallError';
  error.statusCode = 401;
  error.responseBody = JSON.stringify({
    error: { message: 'The API key you provided is invalid.' },
  });

  assert.equal(
    renderAiSdkProviderError(error),
    'The API key you provided is invalid.',
  );
});

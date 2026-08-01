import assert from 'node:assert/strict';
import test from 'node:test';

import { renderResponsesTransportError } from '../open-responses/ai-sdk-message-bridge.js';
import { renderAiSdkProviderError } from './ai-sdk-provider-error.js';

test('renderAiSdkProviderError keeps non-empty Error.message', () => {
  assert.equal(
    renderAiSdkProviderError(new Error('Insufficient Balance')),
    'Insufficient Balance',
  );
});

test('renderAiSdkProviderError reads OpenAI-compatible responseBody when message is empty', () => {
  const error = new Error('') as Error & {
    name: string;
    statusCode: number;
    responseBody: string;
  };
  error.name = 'AI_APICallError';
  error.statusCode = 401;
  error.responseBody = JSON.stringify({
    error: {
      message: 'The API key you provided is invalid.',
      code: 'UNAUTHORIZED',
      type: 'error',
    },
  });

  assert.equal(
    renderAiSdkProviderError(error),
    'The API key you provided is invalid.',
  );
});

test('renderAiSdkProviderError falls back to HTTP status when body has no message', () => {
  const error = new Error('') as Error & {
    name: string;
    statusCode: number;
  };
  error.name = 'AI_APICallError';
  error.statusCode = 503;

  assert.equal(renderAiSdkProviderError(error), 'AI_APICallError (HTTP 503)');
});

test('renderResponsesTransportError delegates to renderAiSdkProviderError for empty APICallError.message', () => {
  const error = new Error('') as Error & {
    name: string;
    statusCode: number;
    responseBody: string;
  };
  error.name = 'AI_APICallError';
  error.statusCode = 400;
  error.responseBody = JSON.stringify({
    error: {
      message: 'Codex integration with deepseek-v4-pro will be available starting early August 2026.',
      type: 'invalid_request_error',
    },
  });

  assert.equal(
    renderResponsesTransportError(error),
    'Codex integration with deepseek-v4-pro will be available starting early August 2026.',
  );
});

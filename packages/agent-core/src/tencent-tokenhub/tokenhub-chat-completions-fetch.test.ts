import assert from 'node:assert/strict';
import test from 'node:test';

import { createTokenHubChatCompletionsAwareFetch } from './tokenhub-chat-completions-fetch.js';
import {
  isTokenHubCnApiBase,
  isTokenHubWebSearchModel,
  shouldUseTokenHubWebSearch,
} from './tokenhub-web-search.js';

test('isTokenHubCnApiBase recognizes Guangzhou endpoint only', () => {
  assert.equal(isTokenHubCnApiBase('https://tokenhub.tencentmaas.com/v1'), true);
  assert.equal(isTokenHubCnApiBase('https://tokenhub-intl.tencentmaas.com/v1'), false);
  assert.equal(isTokenHubCnApiBase(undefined), false);
});

test('isTokenHubWebSearchModel matches documented allowlist', () => {
  assert.equal(isTokenHubWebSearchModel('hy3-preview'), true);
  assert.equal(isTokenHubWebSearchModel('deepseek-v4-pro'), true);
  assert.equal(isTokenHubWebSearchModel('hy3'), false);
});

test('shouldUseTokenHubWebSearch gates vendor region model and profile', () => {
  const eligible = {
    llmVendor: 'tencent-tokenhub' as const,
    model: 'hy3-preview',
    baseUrl: 'https://tokenhub.tencentmaas.com/v1',
    transportKind: 'openai-compatible' as const,
  };
  assert.equal(shouldUseTokenHubWebSearch(eligible), true);
  assert.equal(
    shouldUseTokenHubWebSearch({
      ...eligible,
      baseUrl: 'https://tokenhub-intl.tencentmaas.com/v1',
    }),
    false,
  );
  assert.equal(
    shouldUseTokenHubWebSearch({
      ...eligible,
      model: 'glm-5',
    }),
    false,
  );
  assert.equal(
    shouldUseTokenHubWebSearch({
      ...eligible,
      transportRequestProfile: 'code-completion',
    }),
    false,
  );
});

test('createTokenHubChatCompletionsAwareFetch injects web_search_options on cn chat completions', async () => {
  let capturedBody: unknown;
  const baseFetch: typeof fetch = async (_input, init) => {
    capturedBody = init?.body ? JSON.parse(String(init.body)) : undefined;
    return new Response('{}', { status: 200 });
  };

  const fetchImpl = createTokenHubChatCompletionsAwareFetch(
    {
      apiKey: 'k',
      model: 'hy3-preview',
      llmVendor: 'tencent-tokenhub',
      baseUrl: 'https://tokenhub.tencentmaas.com/v1',
    },
    baseFetch,
  );

  await fetchImpl('https://tokenhub.tencentmaas.com/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({ model: 'hy3-preview', messages: [] }),
  });

  assert.deepEqual(capturedBody, {
    model: 'hy3-preview',
    messages: [],
    web_search_options: { enable: true },
  });
});

test('createTokenHubChatCompletionsAwareFetch skips intl endpoint', async () => {
  let capturedBody: unknown;
  const baseFetch: typeof fetch = async (_input, init) => {
    capturedBody = init?.body ? JSON.parse(String(init.body)) : undefined;
    return new Response('{}', { status: 200 });
  };

  const fetchImpl = createTokenHubChatCompletionsAwareFetch(
    {
      apiKey: 'k',
      model: 'hy3-preview',
      llmVendor: 'tencent-tokenhub',
      baseUrl: 'https://tokenhub-intl.tencentmaas.com/v1',
    },
    baseFetch,
  );

  await fetchImpl('https://tokenhub-intl.tencentmaas.com/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({ model: 'hy3-preview', messages: [] }),
  });

  assert.deepEqual(capturedBody, {
    model: 'hy3-preview',
    messages: [],
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createMeituanAnthropicAwareFetch,
  meituanAnthropicThinkingType,
  patchMeituanAnthropicRequestBody,
} from './meituan-anthropic-fetch.js';

test('meituanAnthropicThinkingType maps vendorExtendedThinking to enabled/disabled', () => {
  assert.equal(meituanAnthropicThinkingType(undefined), 'enabled');
  assert.equal(meituanAnthropicThinkingType(true), 'enabled');
  assert.equal(meituanAnthropicThinkingType(false), 'disabled');
});

test('patchMeituanAnthropicRequestBody injects thinking.type for meituan switch models', () => {
  assert.deepEqual(
    patchMeituanAnthropicRequestBody(
      { model: 'LongCat-2.0', messages: [] },
      { llmVendor: 'meituan', supportsThinkingSwitch: true },
    ),
    {
      model: 'LongCat-2.0',
      messages: [],
      thinking: { type: 'enabled' },
    },
  );
  assert.deepEqual(
    patchMeituanAnthropicRequestBody(
      { model: 'LongCat-2.0', messages: [], thinking: { type: 'disabled' } },
      {
        llmVendor: 'meituan',
        supportsThinkingSwitch: true,
        vendorExtendedThinking: false,
      },
    ),
    {
      model: 'LongCat-2.0',
      messages: [],
      thinking: { type: 'disabled' },
    },
  );
});

test('patchMeituanAnthropicRequestBody leaves non-meituan bodies unchanged', () => {
  const body = { model: 'claude-sonnet-4-6', messages: [] };
  assert.equal(
    patchMeituanAnthropicRequestBody(body, {}),
    body,
  );
});

test('createMeituanAnthropicAwareFetch patches LongCat messages requests', async () => {
  let capturedBody: string | undefined;
  const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = typeof init?.body === 'string' ? init.body : undefined;
    return new Response('{}', { status: 200 });
  };

  const fetch = createMeituanAnthropicAwareFetch(fetchImpl, {
    llmVendor: 'meituan',
    supportsThinkingSwitch: true,
    vendorExtendedThinking: false,
  });

  await fetch('https://api.longcat.chat/anthropic/v1/messages', {
    method: 'POST',
    body: JSON.stringify({ model: 'LongCat-2.0', messages: [] }),
  });

  assert.deepEqual(JSON.parse(capturedBody ?? '{}'), {
    model: 'LongCat-2.0',
    messages: [],
    thinking: { type: 'disabled' },
  });
});

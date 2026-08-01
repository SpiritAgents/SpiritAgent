import assert from 'node:assert/strict';
import test from 'node:test';

import { setLlmFetchTransportOverrideForTests } from './llm-fetch.js';
import {
  LLM_MAX_RETRIES,
  observeLlmFetchResponse,
  runInLlmRetryObservationContext,
} from './llm-retry.js';

test('observeLlmFetchResponse emits retry then cleared for retryable HTTP statuses', async () => {
  const events: string[] = [];

  await runInLlmRetryObservationContext({
    maxRetries: LLM_MAX_RETRIES,
    observer: (event) => {
      if (event.kind === 'retry') {
        events.push(`retry:${event.attempt}/${event.maxAttempts}:${event.error}`);
        return;
      }
      events.push('cleared');
    },
  }, async () => {
    await observeLlmFetchResponse(
      new Response(JSON.stringify({ error: { message: 'Rate limit exceeded' } }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await observeLlmFetchResponse(new Response('ok', { status: 200 }));
  });

  assert.deepEqual(events, [
    'retry:1/3:Rate limit exceeded',
    'cleared',
  ]);
});

test('getLlmFetch observes retryable responses inside retry observation context', async () => {
  const events: string[] = [];
  setLlmFetchTransportOverrideForTests(async () =>
    new Response(JSON.stringify({ error: { message: 'Too many requests' } }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

  try {
    await runInLlmRetryObservationContext({
      observer: (event) => {
        if (event.kind === 'retry') {
          events.push(`${event.attempt}/${event.maxAttempts}`);
        }
      },
    }, async () => {
      const { getLlmFetch } = await import('./llm-fetch.js');
      const response = await getLlmFetch()('https://example.test/v1/responses', { method: 'POST' });
      assert.equal(response.status, 429);
    });
  } finally {
    setLlmFetchTransportOverrideForTests(undefined);
  }

  assert.deepEqual(events, ['1/3']);
});

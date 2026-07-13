import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STEPFUN_SEARCH_URL,
  formatStepfunSearchResults,
  invokeStepfunSearch,
} from './stepfun-search-client.js';

test('formatStepfunSearchResults serializes result fields', () => {
  const formatted = formatStepfunSearchResults([
    {
      title: 'Example',
      url: 'https://example.com',
      snippet: 'Snippet text',
      content: 'Body text',
      time: '2026-01-01',
    },
  ]);
  assert.match(formatted, /Example/);
  assert.match(formatted, /https:\/\/example.com/);
  assert.match(formatted, /Snippet text/);
  assert.match(formatted, /Body text/);
});

test('invokeStepfunSearch posts to fixed /v1/search endpoint', async () => {
  let capturedUrl = '';
  let capturedBody: unknown;
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = typeof input === 'string' ? input : input.toString();
    capturedBody = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        results: [{ title: 'Hit', url: 'https://hit.example', snippet: 'Found it' }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  const result = await invokeStepfunSearch('sk-test', { query: 'latest news', n: 5 }, fetchImpl);
  assert.equal(result.kind, 'succeeded');
  assert.equal(capturedUrl, STEPFUN_SEARCH_URL);
  assert.deepEqual(capturedBody, { query: 'latest news', n: 5 });
  if (result.kind === 'succeeded') {
    assert.match(result.content, /Hit/);
  }
});

test('invokeStepfunSearch rejects empty query', async () => {
  const result = await invokeStepfunSearch('sk-test', { query: '   ' });
  assert.equal(result.kind, 'failed');
});

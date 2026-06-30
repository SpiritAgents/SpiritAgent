import assert from 'node:assert/strict';
import test from 'node:test';

import { setLlmFetchTransportOverrideForTests } from '../../llm-fetch.js';
import {
  clearMoonshotFormulaToolsCacheForTests,
  createMoonshotFormulaChatCompletionsAwareFetch,
  mergeMoonshotFormulaToolsIntoChatCompletionsTools,
} from './moonshot-chat-completions-fetch.js';

const moonshotConfig = {
  apiKey: 'test-key',
  model: 'kimi-k2.5',
  llmVendor: 'moonshot-ai' as const,
  baseUrl: 'https://api.moonshot.ai/v1',
};

test('mergeMoonshotFormulaToolsIntoChatCompletionsTools appends unique function tools', () => {
  const merged = mergeMoonshotFormulaToolsIntoChatCompletionsTools(
    [
      {
        type: 'function',
        function: { name: 'read_file', description: 'Read a file' },
      },
    ],
    [
      {
        type: 'function',
        function: { name: 'web_search', description: 'Search the web' },
      },
    ],
  );

  assert.equal(merged.length, 2);
  assert.equal((merged[1] as { function: { name: string } }).function.name, 'web_search');
});

test('createMoonshotFormulaChatCompletionsAwareFetch injects formula tools into chat body', async () => {
  clearMoonshotFormulaToolsCacheForTests();

  const calls: Array<{ url: string; body?: string | undefined }> = [];
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const body = typeof init?.body === 'string' ? init.body : undefined;
    calls.push(body === undefined ? { url } : { url, body });

    if (url.includes('/formulas/')) {
      return new Response(
        JSON.stringify({
          tools: [
            {
              type: 'function',
              function: {
                name: 'web_search',
                description: 'Search the web for information',
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response('{}', { status: 200 });
  };

  setLlmFetchTransportOverrideForTests(fetchImpl);
  try {
    const patchedFetch = createMoonshotFormulaChatCompletionsAwareFetch(moonshotConfig, fetchImpl);
    await patchedFetch('https://api.moonshot.ai/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: 'kimi-k2.5',
        messages: [{ role: 'user', content: 'hi' }],
        tools: [
          {
            type: 'function',
            function: { name: 'read_file' },
          },
        ],
      }),
    });

    const chatCall = calls.find((call) => call.url.includes('/chat/completions'));
    assert.ok(chatCall?.body);
    const body = JSON.parse(chatCall.body) as { tools: Array<{ function: { name: string } }> };
    assert.equal(body.tools.length, 2);
    assert.equal(body.tools[1]?.function.name, 'web_search');
  } finally {
    setLlmFetchTransportOverrideForTests(undefined);
    clearMoonshotFormulaToolsCacheForTests();
  }
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { setLlmFetchTransportOverrideForTests } from '../llm-fetch.js';
import { AiSdkOpenAiCompatibleTransport } from './ai-sdk-transport.js';

test('GPT-5.6 chat completions use nested reasoning object without top-level reasoning_effort', async () => {
  const capturedBodies: Record<string, unknown>[] = [];
  setLlmFetchTransportOverrideForTests(async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    capturedBodies.push(body);
    return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'ok' } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  const transport = new AiSdkOpenAiCompatibleTransport();
  try {
    const result = await transport.startToolAgentRound(
      {
        apiKey: 'test-key',
        model: 'openai/gpt-5.6-sol',
        baseUrl: 'https://gateway.example.com/v1',
        llmVendor: 'cloudflare-ai-gateway',
        reasoningEffort: 'max',
        reasoningMode: 'pro',
        workspaceRoot: process.cwd(),
      },
      { messages: [{ role: 'user', content: 'hi' }], steps: 0 },
      [],
    );

    assert.equal(result.kind, 'success');
    const chatCompletionBody = capturedBodies.at(-1);
    assert.ok(chatCompletionBody);
    assert.deepEqual(chatCompletionBody.reasoning, { mode: 'pro', effort: 'max' });
    assert.equal(chatCompletionBody.reasoning_effort, undefined);
  } finally {
    setLlmFetchTransportOverrideForTests(undefined);
  }
});

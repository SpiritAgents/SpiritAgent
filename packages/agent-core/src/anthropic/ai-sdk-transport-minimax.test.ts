import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyCodeCompletionTransportProfile } from '../code-completion/transport-profile.js';
import { setLlmFetchTransportOverrideForTests } from '../llm-fetch.js';
import { AiSdkAnthropicTransport } from './ai-sdk-transport.js';

test('MiniMax anthropic transport uses minimax anthropic endpoint', async () => {
  const capturedUrls: string[] = [];
  setLlmFetchTransportOverrideForTests(async (input) => {
    capturedUrls.push(String(input));
    return new Response(JSON.stringify({
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'ok' }],
      model: 'MiniMax-M3',
      stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  const transport = new AiSdkAnthropicTransport();
  try {
    const result = await transport.startToolAgentRound(
      {
        transportKind: 'anthropic',
        apiKey: 'test-key',
        model: 'MiniMax-M3',
        baseUrl: 'https://api.minimax.io/anthropic/v1',
        llmVendor: 'minimax',
        workspaceRoot: process.cwd(),
      },
      { messages: [{ role: 'user', content: 'hi' }], steps: 0 },
      [],
    );

    assert.equal(result.kind, 'success');
    assert.ok(capturedUrls.some((url) => url.includes('api.minimax.io/anthropic/v1/messages')));
  } finally {
    setLlmFetchTransportOverrideForTests(undefined);
  }
});

test('MiniMax anthropic code-completion profile disables M3 thinking', () => {
  const profiled = applyCodeCompletionTransportProfile({
    transportKind: 'anthropic',
    apiKey: 'test-key',
    model: 'MiniMax-M3',
    baseUrl: 'https://api.minimax.io/anthropic/v1',
    llmVendor: 'minimax',
  });

  assert.equal(profiled.transportRequestProfile, 'code-completion');
  if (profiled.transportKind === 'anthropic') {
    assert.equal(profiled.vendorExtendedThinking, false);
  }
});

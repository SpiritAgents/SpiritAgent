import assert from 'node:assert/strict';
import test from 'node:test';
import type { TextStreamPart } from 'ai';

import type { ToolAgentRoundCompletion } from '../ports.js';
import type { ToolAgentState } from '../tool-agent.js';
import { extractLastAssistantText } from '../tool-agent.js';
import { createDeferred, responsesEventStreamToRuntimeEvents } from './streaming.js';
import type { OpenResponsesTransportConfig } from './responses-compat.js';

const gatewayConfig: OpenResponsesTransportConfig = {
  transportKind: 'open-responses',
  apiKey: 'test',
  model: 'deepseek/deepseek-v4-pro',
  llmVendor: 'vercel-ai-gateway',
};

async function collectGatewayToolRound(
  stream: AsyncIterable<TextStreamPart<any>>,
): Promise<Extract<ToolAgentRoundCompletion<ToolAgentState>, { kind: 'success' }>> {
  const state: ToolAgentState = { messages: [], steps: 0 };
  const completion = createDeferred<ToolAgentRoundCompletion<ToolAgentState>>();

  for await (const _event of responsesEventStreamToRuntimeEvents(
    gatewayConfig,
    stream,
    {},
    state,
    [],
    completion,
  )) {
    // drain
  }

  const result = await completion.promise;
  assert.equal(result.kind, 'success');
  if (result.kind !== 'success') {
    throw new Error('expected success completion');
  }
  return result;
}

test('gateway sdk stream aggregates tool-input/tool-call without Open Responses raw items', async () => {
  async function* stream(): AsyncGenerator<TextStreamPart<any>> {
    yield { type: 'reasoning-delta', id: 'reasoning-0', text: 'Plan to run shell.' };
    yield { type: 'tool-input-start', id: 'call_gateway_shell', toolName: 'run_shell_command' };
    yield { type: 'tool-input-delta', id: 'call_gateway_shell', delta: '{"reason":"Echo","command":"echo nb"}' };
    yield { type: 'tool-input-end', id: 'call_gateway_shell' };
    yield {
      type: 'tool-call',
      toolCallId: 'call_gateway_shell',
      toolName: 'run_shell_command',
      input: { reason: 'Echo', command: 'echo nb' },
    };
  }

  const completion = await collectGatewayToolRound(stream());
  const round = completion.result;
  assert.equal(round.step.kind, 'tool-calls');
  if (round.step.kind !== 'tool-calls') {
    throw new Error('expected tool-calls step');
  }

  assert.equal(round.step.calls.length, 1);
  assert.equal(round.step.calls[0]?.id, 'call_gateway_shell');
  assert.equal(round.step.calls[0]?.name, 'run_shell_command');
  assert.equal(extractLastAssistantText(round.state), undefined);
});

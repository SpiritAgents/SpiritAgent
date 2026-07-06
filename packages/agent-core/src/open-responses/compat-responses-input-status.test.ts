import assert from 'node:assert/strict';
import test from 'node:test';

import type { JsonObject } from '../ports.js';
import {
  patchVolcengineResponsesInputItemStatus,
  shouldPatchVolcengineResponsesInputItemStatus,
} from './compat-responses-input-status.js';

test('shouldPatchVolcengineResponsesInputItemStatus is volcengine-only', () => {
  assert.equal(
    shouldPatchVolcengineResponsesInputItemStatus({ llmVendor: 'volcengine' }),
    true,
  );
  assert.equal(
    shouldPatchVolcengineResponsesInputItemStatus({ llmVendor: 'alibaba' }),
    false,
  );
});

test('patchVolcengineResponsesInputItemStatus fills completed on message and tool items', () => {
  const body = {
    input: [
      {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'hi' }],
      },
      {
        type: 'function_call',
        call_id: 'call_1',
        name: 'grep',
        arguments: '{}',
      },
      {
        type: 'function_call_output',
        call_id: 'call_1',
        output: 'ok',
      },
      {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'done' }],
        status: 'completed',
      },
    ],
  } as JsonObject;

  patchVolcengineResponsesInputItemStatus(body);

  const input = body.input as JsonObject[];
  assert.equal(input[0]?.status, 'completed');
  assert.equal(input[1]?.status, 'completed');
  assert.equal(input[2]?.status, 'completed');
  assert.equal(input[3]?.status, 'completed');
});

test('patchVolcengineResponsesInputItemStatus preserves failed status', () => {
  const body = {
    input: [
      {
        type: 'function_call_output',
        call_id: 'call_1',
        output: 'error',
        status: 'failed',
      },
    ],
  } as JsonObject;

  patchVolcengineResponsesInputItemStatus(body);

  const input = body.input as JsonObject[];
  assert.equal(input[0]?.status, 'failed');
});

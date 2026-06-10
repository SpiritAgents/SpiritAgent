import assert from 'node:assert/strict';
import test from 'node:test';

import { mapRuntimeEventToUpdate } from '../src/event-mapper.js';
import type { RuntimeEvent, JsonValue } from '@spirit-agent/core';

const SESSION_ID = 'sess_test123';

// --- assistant-chunk ---

test('assistant-chunk → agent_message_chunk', () => {
  const event: RuntimeEvent<JsonValue> = { kind: 'assistant-chunk', text: 'Hello world' };
  const result = mapRuntimeEventToUpdate(event, SESSION_ID);
  assert.ok(result);
  assert.equal(result.sessionId, SESSION_ID);
  const update = (result as any).update;
  assert.equal(update.sessionUpdate, 'agent_message_chunk');
  assert.equal(update.content.type, 'text');
  assert.equal(update.content.text, 'Hello world');
});

// --- streaming-tool-preview ---

test('streaming-tool-preview → tool_call with proper kind and title', () => {
  const event: RuntimeEvent<JsonValue> = {
    kind: 'streaming-tool-preview',
    toolCallId: 'call_1',
    toolName: 'read_file',
    argumentsJson: JSON.stringify({ path: '/home/user/main.ts' }),
  };
  const result = mapRuntimeEventToUpdate(event, SESSION_ID);
  assert.ok(result);
  const update = (result as any).update;
  assert.equal(update.sessionUpdate, 'tool_call');
  assert.equal(update.toolCallId, 'call_1');
  assert.equal(update.kind, 'read');
  assert.equal(update.status, 'pending');
  assert.ok(update.title.includes('main.ts'));
  assert.ok(update.locations);
  assert.equal(update.locations.length, 1);
});

test('streaming-tool-preview: run_shell_command → execute kind', () => {
  const event: RuntimeEvent<JsonValue> = {
    kind: 'streaming-tool-preview',
    toolCallId: 'call_2',
    toolName: 'run_shell_command',
    argumentsJson: JSON.stringify({ command: 'npm test' }),
  };
  const result = mapRuntimeEventToUpdate(event, SESSION_ID);
  assert.ok(result);
  const update = (result as any).update;
  assert.equal(update.kind, 'execute');
});

// --- tool-call-started ---

test('tool-call-started → tool_call_update in_progress', () => {
  const event: RuntimeEvent<JsonValue> = {
    kind: 'tool-call-started',
    toolCallId: 'call_1',
    toolName: 'read_file',
    request: {} as JsonValue,
  };
  const result = mapRuntimeEventToUpdate(event, SESSION_ID);
  assert.ok(result);
  const update = (result as any).update;
  assert.equal(update.sessionUpdate, 'tool_call_update');
  assert.equal(update.toolCallId, 'call_1');
  assert.equal(update.status, 'in_progress');
});

// --- tool-execution-finished ---

test('tool-execution-finished: success → completed', () => {
  const event: RuntimeEvent<JsonValue> = {
    kind: 'tool-execution-finished',
    execution: {
      toolCallId: 'call_1',
      toolName: 'read_file',
      request: {} as JsonValue,
      output: 'file contents here',
      failed: false,
    },
  };
  const result = mapRuntimeEventToUpdate(event, SESSION_ID);
  assert.ok(result);
  const update = (result as any).update;
  assert.equal(update.status, 'completed');
  assert.ok(update.content);
  assert.ok(update.content.length > 0);
});

test('tool-execution-finished: failure → failed', () => {
  const event: RuntimeEvent<JsonValue> = {
    kind: 'tool-execution-finished',
    execution: {
      toolCallId: 'call_2',
      toolName: 'run_shell_command',
      request: {} as JsonValue,
      output: 'exit code 1',
      failed: true,
    },
  };
  const result = mapRuntimeEventToUpdate(event, SESSION_ID);
  assert.ok(result);
  const update = (result as any).update;
  assert.equal(update.status, 'failed');
});

// --- context-usage-updated ---

test('context-usage-updated → usage_update', () => {
  const event: RuntimeEvent<JsonValue> = {
    kind: 'context-usage-updated',
    usage: {
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
    },
  };
  const result = mapRuntimeEventToUpdate(event, SESSION_ID);
  assert.ok(result);
  const update = (result as any).update;
  assert.equal(update.sessionUpdate, 'usage_update');
  assert.equal(update.used, 1500);
});

// --- events that should return undefined ---

test('approval-requested → undefined', () => {
  const event: RuntimeEvent<JsonValue> = {
    kind: 'approval-requested',
    approval: {} as any,
  };
  const result = mapRuntimeEventToUpdate(event, SESSION_ID);
  assert.equal(result, undefined);
});

test('begin-assistant-response → undefined', () => {
  const event: RuntimeEvent<JsonValue> = { kind: 'begin-assistant-response' };
  const result = mapRuntimeEventToUpdate(event, SESSION_ID);
  assert.equal(result, undefined);
});

test('history-compacted → undefined', () => {
  const event: RuntimeEvent<JsonValue> = { kind: 'history-compacted', droppedMessages: 5 };
  const result = mapRuntimeEventToUpdate(event, SESSION_ID);
  assert.equal(result, undefined);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DesktopAssistantMessageStateMachine } from '../../dist-electron/src/host/assistant-message-state.js';

function createHarness() {
  let messages = [];
  let nextMessageId = 1;
  const assistantMessages = new DesktopAssistantMessageStateMachine({
    messages: () => messages,
    setMessages: (nextMessages) => {
      messages = nextMessages;
    },
    allocateMessageId: () => nextMessageId++,
    isRuntimeBusy: () => true,
  });

  return {
    assistantMessages,
    messages: () => messages,
    pushUser(content) {
      messages.push({
        id: nextMessageId++,
        role: 'user',
        content,
        pending: false,
      });
    },
  };
}

function toolBlock(toolCallId, phase = 'succeeded') {
  return {
    toolCallId,
    toolName: 'read_file',
    phase,
    headline: phase === 'running' ? 'Reading file' : 'Read file',
    detailLines: [],
    argsExcerpt: '{}',
  };
}

function rowToken(message) {
  if (message.role === 'user') return 'user';
  if (message.tool) return `tool:${message.tool.toolCallId}`;
  if (message.aux?.thinking) return `thinking:${message.aux.thinking}`;
  if (message.pending) return 'pending-assistant';
  return `assistant:${message.content}`;
}

test('continuation finalized thinking stays after previous segment tool rows', () => {
  const harness = createHarness();
  const { assistantMessages } = harness;
  harness.pushUser('inspect this file');

  assistantMessages.beginAssistantResponse(harness.messages().length, 1);
  assistantMessages.updatePendingAssistantAux('thinking', 'first reasoning');
  assistantMessages.appendAssistantThinkingSegment('first reasoning');
  assistantMessages.upsertToolMessage('call-1', toolBlock('call-1'), 2);
  assistantMessages.removePendingAssistantMessage();

  assert.deepEqual(harness.messages().map(rowToken), [
    'user',
    'thinking:first reasoning',
    'tool:call-1',
  ]);

  assistantMessages.resetStreamingPlacementState(false);
  assistantMessages.beginAssistantResponse(harness.messages().length, 3);
  assistantMessages.upsertToolMessage('call-2', toolBlock('call-2', 'running'), 4);
  assistantMessages.appendAssistantThinkingSegment('second reasoning');
  assistantMessages.removePendingAssistantMessage();

  const rows = harness.messages().map(rowToken);
  assert.deepEqual(rows, [
    'user',
    'thinking:first reasoning',
    'tool:call-1',
    'thinking:second reasoning',
    'tool:call-2',
  ]);
  assert.ok(
    rows.indexOf('thinking:second reasoning') > rows.indexOf('tool:call-1'),
    'continued thinking must not be inserted before the previous segment tool row',
  );
});
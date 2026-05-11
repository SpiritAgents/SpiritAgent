import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DesktopMessageTimeline } from '../../dist-electron/src/host/message-timeline.js';

function createTimeline() {
  let nextMessageId = 1;
  return new DesktopMessageTimeline({
    allocateMessageId: () => nextMessageId++,
  });
}

function toolBlock(toolCallId, phase = 'running') {
  return {
    toolCallId,
    toolName: 'read_file',
    phase,
    headline: phase === 'succeeded' ? 'Read file' : 'Reading file',
    detailLines: [],
    argsExcerpt: '{}',
  };
}

function rowToken(message) {
  if (message.role === 'user') return `user:${message.content}`;
  if (message.tool) return `tool:${message.tool.toolCallId}:${message.tool.phase}`;
  if (message.aux?.thinking) return `thinking:${message.aux.thinking}`;
  if (message.aux?.compaction) return `compaction:${message.aux.compaction}`;
  return `${message.pending ? 'pending' : 'assistant'}:${message.content}`;
}

test('continuation segments derive rows after previous segment rows', () => {
  const timeline = createTimeline();
  timeline.beginUserTurn('inspect this file');

  timeline.beginAssistantSegment('initial');
  timeline.finalizeThinkingSegment('first reasoning');
  timeline.upsertToolMessage('call-1', toolBlock('call-1', 'succeeded'));
  timeline.removePendingAssistantText();

  timeline.beginAssistantSegment('continuation');
  timeline.upsertToolMessage('call-2', toolBlock('call-2'));
  timeline.finalizeThinkingSegment('second reasoning');
  timeline.removePendingAssistantText();

  assert.deepEqual(timeline.toMessages().map(rowToken), [
    'user:inspect this file',
    'thinking:first reasoning',
    'tool:call-1:succeeded',
    'thinking:second reasoning',
    'tool:call-2:running',
  ]);
});

test('fallback tool keys are scoped to the active segment', () => {
  const timeline = createTimeline();
  timeline.beginUserTurn('first turn');
  timeline.beginAssistantSegment('initial');
  timeline.upsertToolMessage('pending:read_file', toolBlock('pending:read_file'));
  timeline.removePendingAssistantText();

  timeline.beginUserTurn('second turn');
  timeline.beginAssistantSegment('initial');
  timeline.upsertToolMessage('pending:read_file', toolBlock('pending:read_file', 'succeeded'));
  timeline.removePendingAssistantText();

  assert.deepEqual(timeline.toMessages().map(rowToken), [
    'user:first turn',
    'tool:pending:read_file:running',
    'user:second turn',
    'tool:pending:read_file:succeeded',
  ]);
});

test('assistant text splits around tool rows inside a segment', () => {
  const timeline = createTimeline();
  timeline.beginUserTurn('check status');
  timeline.beginAssistantSegment('initial');
  timeline.appendAssistantTextChunk('I will inspect it.');
  timeline.upsertToolMessage('call-1', toolBlock('call-1', 'succeeded'));
  timeline.appendAssistantTextChunk('Done.');
  timeline.completeActiveAssistantSegment();

  assert.deepEqual(timeline.toMessages().map(rowToken), [
    'user:check status',
    'assistant:I will inspect it.',
    'tool:call-1:succeeded',
    'assistant:Done.',
  ]);
});
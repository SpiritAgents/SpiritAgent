import assert from 'node:assert/strict';
import test from 'node:test';

import { createLlmMessageContentFromText } from './ports.js';
import { wrapCompactSummaryBlock } from './llm-context-block.js';
import {
  buildMergedSessionTranscript,
  mergeSealedTranscriptMessages,
  mergeSessionTranscripts,
} from './transcript-sync.js';
import type { SessionTranscriptMessage } from './transcript.js';

function userMessage(text: string): SessionTranscriptMessage {
  return { role: 'user', content: createLlmMessageContentFromText(text) };
}

test('mergeSealedTranscriptMessages prefers longer live history before compaction', () => {
  const sealed = [userMessage('a')];
  const live = [userMessage('a'), userMessage('b')];
  assert.deepEqual(mergeSealedTranscriptMessages(sealed, live), live);
});

test('mergeSealedTranscriptMessages appends post-compaction live messages once', () => {
  const sealed = [userMessage('a'), userMessage('b')];
  const live = [userMessage('c')];
  const merged = mergeSealedTranscriptMessages(sealed, live);
  assert.deepEqual(merged, [userMessage('a'), userMessage('b'), userMessage('c')]);
  assert.deepEqual(mergeSealedTranscriptMessages(merged, live), merged);
});

test('mergeSealedTranscriptMessages appends only unsynced post-compaction suffix', () => {
  const sealed = [userMessage('a'), userMessage('b'), userMessage('c')];
  const live = [userMessage('b'), userMessage('c'), userMessage('d')];
  assert.deepEqual(
    mergeSealedTranscriptMessages(sealed, live),
    [userMessage('a'), userMessage('b'), userMessage('c'), userMessage('d')],
  );
});

test('buildMergedSessionTranscript ignores compact summary and appends new user turns', () => {
  const { transcript, sealedMessages } = buildMergedSessionTranscript(
    [userMessage('old-a'), userMessage('old-b')],
    [
      {
        role: 'system',
        content: createLlmMessageContentFromText(wrapCompactSummaryBlock('summary')),
      },
      {
        role: 'user',
        content: createLlmMessageContentFromText('new'),
      },
    ],
    1,
  );
  assert.equal(transcript.message_count, 3);
  assert.equal(sealedMessages.length, 3);
  assert.equal(sealedMessages[2]?.role, 'user');
});

test('mergeSessionTranscripts never shrinks an existing longer transcript', () => {
  const existing = {
    export_version: 1 as const,
    kind: 'session_transcript' as const,
    exported_at_unix_ms: 1,
    message_count: 2,
    messages: [userMessage('a'), userMessage('b')],
  };
  const incoming = {
    export_version: 1 as const,
    kind: 'session_transcript' as const,
    exported_at_unix_ms: 2,
    message_count: 1,
    messages: [userMessage('c')],
  };
  const merged = mergeSessionTranscripts(existing, incoming);
  assert.equal(merged.message_count, 3);
  assert.deepEqual(merged.messages.map((message) => (
    message.content[0]?.type === 'text' ? message.content[0].text : ''
  )), ['a', 'b', 'c']);
});

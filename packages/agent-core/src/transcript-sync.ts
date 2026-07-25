import type { LlmMessage } from './ports.js';
import {
  buildSessionTranscript,
  type SessionTranscript,
  type SessionTranscriptMessage,
} from './transcript.js';

function transcriptMessagesEqual(
  left: SessionTranscriptMessage,
  right: SessionTranscriptMessage,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sealedEndsWithLive(
  sealed: readonly SessionTranscriptMessage[],
  live: readonly SessionTranscriptMessage[],
): boolean {
  if (live.length === 0) {
    return true;
  }
  if (live.length > sealed.length) {
    return false;
  }
  const offset = sealed.length - live.length;
  for (let index = 0; index < live.length; index += 1) {
    const sealedMessage = sealed[offset + index];
    const liveMessage = live[index];
    if (
      sealedMessage === undefined
      || liveMessage === undefined
      || !transcriptMessagesEqual(sealedMessage, liveMessage)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Merge sealed (durable) transcript messages with a live build from current history.
 * After compaction, live history shrinks — keep sealed and append only new live messages.
 */
export function mergeSealedTranscriptMessages(
  sealed: readonly SessionTranscriptMessage[],
  live: readonly SessionTranscriptMessage[],
): SessionTranscriptMessage[] {
  if (sealed.length === 0) {
    return [...live];
  }
  if (live.length >= sealed.length) {
    return [...live];
  }
  if (sealedEndsWithLive(sealed, live)) {
    return [...sealed];
  }
  return [...sealed, ...live];
}

export function buildMergedSessionTranscript(
  sealed: readonly SessionTranscriptMessage[],
  history: readonly LlmMessage[],
  exportedAtUnixMs: number = Date.now(),
): { transcript: SessionTranscript; sealedMessages: SessionTranscriptMessage[] } {
  const live = buildSessionTranscript(history, exportedAtUnixMs);
  const sealedMessages = mergeSealedTranscriptMessages(sealed, live.messages);
  return {
    transcript: {
      ...live,
      message_count: sealedMessages.length,
      messages: sealedMessages,
    },
    sealedMessages,
  };
}

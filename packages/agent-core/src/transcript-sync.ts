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

function sealedIsPrefixOfLive(
  sealed: readonly SessionTranscriptMessage[],
  live: readonly SessionTranscriptMessage[],
): boolean {
  if (sealed.length > live.length) {
    return false;
  }
  for (let index = 0; index < sealed.length; index += 1) {
    const sealedMessage = sealed[index];
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
 * After compaction, live history shrinks — keep sealed and append only unsynced live suffix.
 */
export function mergeSealedTranscriptMessages(
  sealed: readonly SessionTranscriptMessage[],
  live: readonly SessionTranscriptMessage[],
): SessionTranscriptMessage[] {
  if (sealed.length === 0) {
    return [...live];
  }
  if (live.length === 0) {
    return [...sealed];
  }
  // Pre-compaction growth: sealed is a prefix of the longer live history.
  if (live.length >= sealed.length && sealedIsPrefixOfLive(sealed, live)) {
    return [...live];
  }
  // Already fully synced (live is a suffix of sealed).
  if (sealedEndsWithLive(sealed, live)) {
    return [...sealed];
  }
  // Post-compaction: live is the full post-compact conversation; append only the new tail.
  let overlap = 0;
  const maxOverlap = Math.min(sealed.length, live.length);
  for (let candidate = maxOverlap; candidate >= 0; candidate -= 1) {
    if (sealedEndsWithLive(sealed, live.slice(0, candidate))) {
      overlap = candidate;
      break;
    }
  }
  return [...sealed, ...live.slice(overlap)];
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
      exported_at_unix_ms: exportedAtUnixMs,
    },
    sealedMessages,
  };
}

export function mergeSessionTranscripts(
  existing: SessionTranscript | undefined,
  incoming: SessionTranscript,
): SessionTranscript {
  if (!existing || !Array.isArray(existing.messages) || existing.messages.length === 0) {
    return incoming;
  }
  const messages = mergeSealedTranscriptMessages(existing.messages, incoming.messages);
  return {
    export_version: incoming.export_version,
    kind: 'session_transcript',
    exported_at_unix_ms: Math.max(existing.exported_at_unix_ms, incoming.exported_at_unix_ms),
    message_count: messages.length,
    messages,
  };
}

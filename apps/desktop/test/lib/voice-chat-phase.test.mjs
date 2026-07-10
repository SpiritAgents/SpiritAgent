import assert from "node:assert/strict";
import test from "node:test";

import { resolveVoiceChatPhase } from "../../src/lib/voice-chat-phase.ts";

test("resolveVoiceChatPhase returns idle when conversation is not busy", () => {
  assert.equal(
    resolveVoiceChatPhase({ conversationBusy: false }),
    "idle",
  );
});

test("resolveVoiceChatPhase returns speaking when conversation is busy", () => {
  assert.equal(
    resolveVoiceChatPhase({ conversationBusy: true }),
    "speaking",
  );
});

test("resolveVoiceChatPhase prefers listening over speaking", () => {
  assert.equal(
    resolveVoiceChatPhase({ conversationBusy: true, listening: true }),
    "listening",
  );
});

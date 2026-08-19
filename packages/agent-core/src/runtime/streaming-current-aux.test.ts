import assert from "node:assert/strict";
import { test } from "node:test";

import { currentAuxKind, type StreamingRuntime } from "./streaming.js";

type CurrentAuxRuntime = Pick<
  StreamingRuntime<unknown, unknown, unknown>,
  | "pendingHistoryCompaction"
  | "pendingStreamingRound"
  | "pendingToolAgentRound"
  | "pendingBackgroundToolExecution"
  | "pendingAssistantTextStore"
  | "thinkingTextStore"
  | "compactionTextStore"
  | "pendingBackgroundToolStatusStore"
  | "awaitingPostBuiltInToolStreamDeltaStore"
>;

function mockStreamingRuntime(
  overrides: Partial<CurrentAuxRuntime> = {},
): StreamingRuntime<unknown, unknown, unknown> {
  return {
    pendingHistoryCompaction: undefined,
    pendingStreamingRound: {},
    pendingToolAgentRound: undefined,
    pendingBackgroundToolExecution: undefined,
    pendingAssistantTextStore: "",
    thinkingTextStore: "",
    compactionTextStore: "",
    pendingBackgroundToolStatusStore: undefined,
    awaitingPostBuiltInToolStreamDeltaStore: false,
    ...overrides,
  } as StreamingRuntime<unknown, unknown, unknown>;
}

test("currentAuxKind suppresses thinking while assistant body streams in the same round", () => {
  assert.equal(
    currentAuxKind(mockStreamingRuntime({ pendingAssistantTextStore: "Prefix text." })),
    undefined,
  );
});

test("currentAuxKind returns thinking after terminal built-in tool despite prior streamed prefix text", () => {
  assert.equal(
    currentAuxKind(
      mockStreamingRuntime({
        pendingAssistantTextStore: "Fine, let's give it a try! It failed, try again:",
        awaitingPostBuiltInToolStreamDeltaStore: true,
      }),
    ),
    "thinking",
  );
});

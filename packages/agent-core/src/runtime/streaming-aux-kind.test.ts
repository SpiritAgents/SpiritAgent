import assert from "node:assert/strict";
import test from "node:test";

import { currentAuxKind, type StreamingRuntime } from "./streaming.js";

function createRuntimeStub(
  overrides: Partial<StreamingRuntime<unknown, unknown, unknown>> = {},
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
    toolPreviewSeenInStreamRoundStore: false,
    providerBuiltinToolTerminalSeenInStreamRoundStore: false,
    ...overrides,
  } as StreamingRuntime<unknown, unknown, unknown>;
}

test("currentAuxKind suppresses thinking aux during pre-tool body streaming", () => {
  const runtime = createRuntimeStub({
    pendingAssistantTextStore: "好的，我去搜搜。",
    thinkingTextStore: "",
  });

  assert.equal(currentAuxKind(runtime), undefined);
});

test("currentAuxKind surfaces thinking aux after terminal provider built-in tool with pre-tool body", () => {
  const runtime = createRuntimeStub({
    pendingAssistantTextStore: "好的，我去搜搜。",
    thinkingTextStore: "",
    providerBuiltinToolTerminalSeenInStreamRoundStore: true,
  });

  assert.equal(currentAuxKind(runtime), "thinking");
});

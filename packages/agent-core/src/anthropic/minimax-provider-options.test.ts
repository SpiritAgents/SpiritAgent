import assert from "node:assert/strict";
import { test } from "vitest";

import { buildMinimaxProviderOptions } from "./minimax-provider-options.js";
import { buildAnthropicProviderOptions } from "./anthropic-compat.js";

test("buildMinimaxProviderOptions returns empty for non-minimax vendor", () => {
  assert.deepEqual(
    buildMinimaxProviderOptions({
      llmVendor: "moonshot-ai",
      model: "MiniMax-M3",
    }),
    {},
  );
});

test("buildMinimaxProviderOptions omits thinking for MiniMax M2.x", () => {
  assert.deepEqual(
    buildMinimaxProviderOptions({
      llmVendor: "minimax",
      model: "MiniMax-M2.5",
    }),
    {},
  );
});

test("buildMinimaxProviderOptions toggles M3 thinking via minimax namespace", () => {
  assert.deepEqual(
    buildMinimaxProviderOptions({
      llmVendor: "minimax",
      model: "MiniMax-M3",
      vendorExtendedThinking: false,
    }),
    {
      minimax: {
        thinking: { type: "disabled" },
      },
    },
  );

  assert.deepEqual(
    buildMinimaxProviderOptions({
      llmVendor: "minimax",
      model: "minimax-m3",
    }),
    {
      minimax: {
        thinking: { type: "adaptive" },
      },
    },
  );
});

test("buildAnthropicTransportProviderOptions merges anthropic and minimax options", () => {
  const merged = {
    ...buildAnthropicProviderOptions({
      llmVendor: "minimax",
      model: "MiniMax-M3",
    }),
    ...buildMinimaxProviderOptions({
      llmVendor: "minimax",
      model: "MiniMax-M3",
      vendorExtendedThinking: false,
    }),
  };

  assert.equal(merged.anthropic?.toolStreaming, true);
  assert.deepEqual(merged.minimax, {
    thinking: { type: "disabled" },
  });
});

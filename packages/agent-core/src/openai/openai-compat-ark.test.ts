import assert from "node:assert/strict";
import test from "node:test";

import { applyCodeCompletionTransportProfile } from "../code-completion/transport-profile.js";
import {
  openAiStreamingUsageBodyExtras,
  openAiVendorChatCompletionBodyExtras,
} from "./openai-compat.js";

for (const llmVendor of ["volcengine", "byteplus"] as const) {
  test(`${llmVendor} code-completion profile disables thinking via thinking.type`, () => {
    const config = applyCodeCompletionTransportProfile({
      apiKey: "k",
      model: "doubao-seed-1-6",
      llmVendor,
    });

    assert.deepEqual(
      openAiVendorChatCompletionBodyExtras(
        config as import("./openai-compat.js").OpenAiTransportConfig,
      ),
      {
        thinking: { type: "disabled" },
      },
    );
  });

  test(`${llmVendor} streaming chat completions request includes stream_options.include_usage`, () => {
    const config = {
      llmVendor,
    } as import("./openai-compat.js").OpenAiTransportConfig;

    assert.deepEqual(openAiStreamingUsageBodyExtras(config, true), {
      stream_options: {
        include_usage: true,
      },
    });
    assert.deepEqual(openAiStreamingUsageBodyExtras(config, false), {});
  });
}

test("non-Ark streaming chat completions omit stream_options.include_usage", () => {
  assert.deepEqual(
    openAiStreamingUsageBodyExtras(
      { llmVendor: "deepseek" } as import("./openai-compat.js").OpenAiTransportConfig,
      true,
    ),
    {},
  );
});

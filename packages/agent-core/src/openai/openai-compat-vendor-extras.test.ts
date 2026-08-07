import assert from "node:assert/strict";
import test from "node:test";

import { applyCodeCompletionTransportProfile } from "../code-completion/transport-profile.js";
import { openAiVendorChatCompletionBodyExtras } from "./openai-compat.js";

test("DeepInfra code-completion profile disables thinking via vendorExtendedThinking", () => {
  const config = applyCodeCompletionTransportProfile({
    apiKey: "k",
    model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    llmVendor: "deepinfra",
    reasoningEffort: "medium",
  }) as import("./openai-compat.js").OpenAiTransportConfig;

  assert.equal(config.transportRequestProfile, "code-completion");
  assert.equal(config.vendorExtendedThinking, false);
  assert.equal(config.reasoningEffort, "default");
});

test("DeepSeek code-completion profile disables thinking via vendorExtendedThinking", () => {
  const config = applyCodeCompletionTransportProfile({
    apiKey: "k",
    model: "deepseek-v4-flash",
    llmVendor: "deepseek",
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

test("Z.ai code-completion profile disables thinking via request body extras", () => {
  const config = applyCodeCompletionTransportProfile({
    apiKey: "k",
    model: "glm-4.7",
    llmVendor: "z-ai",
  });

  assert.equal(
    (config as import("./openai-compat.js").OpenAiTransportConfig).vendorExtendedThinking,
    false,
  );
  assert.deepEqual(
    openAiVendorChatCompletionBodyExtras(
      config as import("./openai-compat.js").OpenAiTransportConfig,
    ),
    {
      thinking: { type: "disabled" },
    },
  );
});

test("Zhipu AI code-completion profile disables thinking via request body extras", () => {
  const config = applyCodeCompletionTransportProfile({
    apiKey: "k",
    model: "glm-4-plus",
    llmVendor: "zhipu-ai",
  });

  assert.equal(
    (config as import("./openai-compat.js").OpenAiTransportConfig).vendorExtendedThinking,
    false,
  );
  assert.deepEqual(
    openAiVendorChatCompletionBodyExtras(
      config as import("./openai-compat.js").OpenAiTransportConfig,
    ),
    {
      thinking: { type: "disabled" },
    },
  );
});

test("Xiaomi code-completion profile disables thinking via request body extras", () => {
  const config = applyCodeCompletionTransportProfile({
    apiKey: "k",
    model: "mimo-v2",
    llmVendor: "xiaomi",
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

test("Meituan LongCat agent profile sends thinking.type when supportsThinkingSwitch", () => {
  assert.deepEqual(
    openAiVendorChatCompletionBodyExtras({
      llmVendor: "meituan",
      model: "LongCat-2.0",
      supportsThinkingSwitch: true,
    }),
    {
      thinking: { type: "enabled" },
    },
  );
  assert.deepEqual(
    openAiVendorChatCompletionBodyExtras({
      llmVendor: "meituan",
      model: "LongCat-2.0",
      supportsThinkingSwitch: true,
      vendorExtendedThinking: false,
    }),
    {
      thinking: { type: "disabled" },
    },
  );
});

test("Meituan models without supportsThinkingSwitch omit thinking.type", () => {
  assert.deepEqual(
    openAiVendorChatCompletionBodyExtras({
      llmVendor: "meituan",
      model: "LongCat-Vision",
    }),
    {},
  );
});

test("Meituan code-completion profile disables thinking when supportsThinkingSwitch", () => {
  const config = applyCodeCompletionTransportProfile({
    apiKey: "k",
    model: "LongCat-2.0",
    llmVendor: "meituan",
    supportsThinkingSwitch: true,
  });

  assert.equal(
    (config as import("./openai-compat.js").OpenAiTransportConfig).vendorExtendedThinking,
    false,
  );
  assert.deepEqual(
    openAiVendorChatCompletionBodyExtras(
      config as import("./openai-compat.js").OpenAiTransportConfig,
    ),
    {
      thinking: { type: "disabled" },
    },
  );
});

test("TokenHub hy3 agent profile sends enabled/disabled thinking.type", () => {
  assert.deepEqual(
    openAiVendorChatCompletionBodyExtras({
      llmVendor: "tencent-tokenhub",
      model: "hy3",
      vendorExtendedThinking: true,
    }),
    {
      thinking: { type: "enabled" },
    },
  );
  assert.deepEqual(
    openAiVendorChatCompletionBodyExtras({
      llmVendor: "tencent-tokenhub",
      model: "hy3",
      vendorExtendedThinking: false,
    }),
    {
      thinking: { type: "disabled" },
    },
  );
});

test("TokenHub minimax-m2.5 omits thinking.type", () => {
  assert.deepEqual(
    openAiVendorChatCompletionBodyExtras({
      llmVendor: "tencent-tokenhub",
      model: "minimax-m2.5",
      vendorExtendedThinking: false,
    }),
    {},
  );
});

test("TokenHub code-completion profile disables thinking via vendorExtendedThinking", () => {
  const config = applyCodeCompletionTransportProfile({
    apiKey: "k",
    model: "hy3",
    llmVendor: "tencent-tokenhub",
  });

  assert.equal(
    (config as import("./openai-compat.js").OpenAiTransportConfig).vendorExtendedThinking,
    false,
  );
  assert.deepEqual(
    openAiVendorChatCompletionBodyExtras(
      config as import("./openai-compat.js").OpenAiTransportConfig,
    ),
    {
      thinking: { type: "disabled" },
    },
  );
});

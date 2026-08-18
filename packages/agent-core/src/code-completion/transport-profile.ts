import type { AnthropicTransportConfig } from "../anthropic/anthropic-compat.js";
import type { BedrockTransportConfig } from "../bedrock/bedrock-compat.js";
import type { OpenAiLlmVendor, OpenAiTransportConfig } from "../openai/openai-compat.js";
import type { OpenResponsesTransportConfig } from "../open-responses/responses-compat.js";
import type { TransportRequestProfile } from "../llm-provider-shared.js";
import type { LlmTransportConfig } from "../provider-config.js";
import { isArkLlmVendor } from "../ark/ark-provider.js";
import {
  isAnthropicTransportConfig,
  isBedrockTransportConfig,
  isOpenAiCompatibleTransportConfig,
  isOpenResponsesTransportConfig,
} from "../provider-config.js";

/** OpenAI-compatible direct vendors that disable extended thinking via `thinking.type` (to be expanded in later phases). */
const OPENAI_COMPAT_THINKING_TYPE_VENDORS = new Set<OpenAiLlmVendor>([
  "deepseek",
  "moonshot-ai",
  "z-ai",
  "zhipu-ai",
  "xiaomi",
  "volcengine",
  "tencent-tokenhub",
]);

export function isCodeCompletionTransportProfile(config: {
  transportRequestProfile?: TransportRequestProfile;
}): boolean {
  return config.transportRequestProfile === "code-completion";
}

function withCodeCompletionProfile<T extends LlmTransportConfig>(config: T): T {
  return {
    ...config,
    transportRequestProfile: "code-completion",
  };
}

/** OpenAI-compatible direct vendors that disable Gemini thinking via reasoningEffort none. */
const OPENAI_COMPAT_GOOGLE_REASONING_NONE_VENDORS = new Set<OpenAiLlmVendor>([
  "google",
  "google-vertex-ai",
]);

function applyOpenAiCompatibleCodeCompletionProfile(
  config: OpenAiTransportConfig,
): OpenAiTransportConfig {
  const profiled = withCodeCompletionProfile(config);
  const vendor = profiled.llmVendor;
  if (vendor === "openai" || vendor === "xai" || vendor === "openrouter") {
    return {
      ...profiled,
      reasoningEffort: "none",
    };
  }
  if (vendor === "custom") {
    return {
      ...profiled,
      reasoningEffort: "none",
    };
  }
  if (vendor !== undefined && OPENAI_COMPAT_GOOGLE_REASONING_NONE_VENDORS.has(vendor)) {
    return {
      ...profiled,
      reasoningEffort: "none",
    };
  }
  if (
    vendor !== undefined &&
    (OPENAI_COMPAT_THINKING_TYPE_VENDORS.has(vendor) ||
      isArkLlmVendor(vendor) ||
      vendor === "deepinfra" ||
      (vendor === "meituan" && config.supportsThinkingSwitch === true))
  ) {
    // Moonshot/DeepSeek etc. are mutually exclusive with thinking.type; the completion path does not send reasoning_effort (default → omitted).
    return {
      ...profiled,
      reasoningEffort: "default",
      vendorExtendedThinking: false,
    };
  }
  return profiled;
}

function applyAnthropicCodeCompletionProfile(
  config: AnthropicTransportConfig,
): AnthropicTransportConfig {
  if (config.llmVendor === "meituan" && config.supportsThinkingSwitch === true) {
    return {
      ...withCodeCompletionProfile(config),
      vendorExtendedThinking: false,
    };
  }
  if (config.llmVendor === "minimax") {
    return {
      ...withCodeCompletionProfile(config),
      vendorExtendedThinking: false,
    };
  }
  return {
    ...withCodeCompletionProfile(config),
    thinking: { type: "disabled" },
  };
}

function applyOpenResponsesCodeCompletionProfile(
  config: OpenResponsesTransportConfig,
): OpenResponsesTransportConfig {
  const profiled = withCodeCompletionProfile(config);
  if (
    profiled.llmVendor === "openai" ||
    profiled.llmVendor === "xai" ||
    profiled.llmVendor === "openrouter" ||
    profiled.llmVendor === "azure" ||
    profiled.llmVendor === "vercel-ai-gateway"
  ) {
    return {
      ...profiled,
      reasoningEffort: "none",
      reasoningSummary: "off",
    };
  }
  return profiled;
}

function applyBedrockCodeCompletionProfile(config: BedrockTransportConfig): BedrockTransportConfig {
  return {
    ...withCodeCompletionProfile(config),
    reasoningEffort: "none",
  };
}

/** Marks any transport config as a code-completion request profile and writes the fields needed to disable thinking per transportKind / llmVendor. */
export function applyCodeCompletionTransportProfile(
  config: LlmTransportConfig,
): LlmTransportConfig {
  if (isAnthropicTransportConfig(config)) {
    return applyAnthropicCodeCompletionProfile(config);
  }
  if (isOpenResponsesTransportConfig(config)) {
    return applyOpenResponsesCodeCompletionProfile(config);
  }
  if (isBedrockTransportConfig(config)) {
    return applyBedrockCodeCompletionProfile(config);
  }
  if (isOpenAiCompatibleTransportConfig(config)) {
    return applyOpenAiCompatibleCodeCompletionProfile(config);
  }
  return withCodeCompletionProfile(config);
}

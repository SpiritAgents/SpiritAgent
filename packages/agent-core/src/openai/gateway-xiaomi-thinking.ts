import type { ModelReasoningEffortContext } from "../reasoning-effort.js";
import type { OpenResponsesReasoningSummary } from "../open-responses/responses-compat.js";
import type { JsonObject } from "../ports.js";
import type { OpenAiTransportConfig } from "./openai-compat.js";
import { parseGatewayUpstreamSlug } from "./gateway-code-completion-thinking.js";

/** Docs: https://mimo.mi.com/docs/en-US/quick-start/usage-guide/other/deep-thinking */
function normalizeXiaomiModelId(model: string): string {
  const normalized = model.trim().toLowerCase();
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
}

/** mimo-v2-flash has no deep thinking mode; other mimo-v* models are forward-compatible. */
export function isXiaomiThinkingSwitchEligibleModel(model: string): boolean {
  const id = normalizeXiaomiModelId(model);
  if (id === "mimo-v2-flash" || id.startsWith("mimo-v2-flash-")) {
    return false;
  }
  return id.startsWith("mimo-v");
}

export function isGatewayXiaomiModel(llmVendor: string | undefined, model: string): boolean {
  return llmVendor === "vercel-ai-gateway" && parseGatewayUpstreamSlug(model) === "xiaomi";
}

/** MiMo Responses API: controlled primarily by Reasoning Effort (same as OpenAI), not Chat thinking.type. */
export function isXiaomiResponsesReasoningEffortContext(
  context?: ModelReasoningEffortContext,
): boolean {
  if (context?.transportKind !== "open-responses") {
    return false;
  }
  const model = context.model ?? "";
  if (context.provider === "xiaomi") {
    return isXiaomiThinkingSwitchEligibleModel(model);
  }
  if (context.provider === "vercel-ai-gateway" && parseGatewayUpstreamSlug(model) === "xiaomi") {
    return isXiaomiThinkingSwitchEligibleModel(model);
  }
  return false;
}

function buildXiaomiResponsesReasoningOptions(
  model: string,
  reasoningEffort: string | undefined,
  reasoningSummary: OpenResponsesReasoningSummary | undefined,
  providerOptionsKey: "openai" | "xiaomi",
): Record<string, JsonObject> {
  if (!isXiaomiThinkingSwitchEligibleModel(model)) {
    return {};
  }

  const reasoningOptions: JsonObject = {
    ...(reasoningEffort !== undefined ? { reasoningEffort } : {}),
    ...(reasoningSummary !== undefined ? { reasoningSummary } : {}),
  };

  if (Object.keys(reasoningOptions).length === 0) {
    return {};
  }

  return { [providerOptionsKey]: reasoningOptions };
}

/** Gateway Xiaomi MiMo Responses: injects reasoningEffort via the openai namespace. */
export function buildGatewayXiaomiResponsesProviderOptions(
  config: Pick<OpenAiTransportConfig, "llmVendor" | "model">,
  reasoningEffort: string | undefined,
  reasoningSummary?: OpenResponsesReasoningSummary,
): Record<string, JsonObject> {
  if (!isGatewayXiaomiModel(config.llmVendor, config.model)) {
    return {};
  }
  return buildXiaomiResponsesReasoningOptions(
    config.model,
    reasoningEffort,
    reasoningSummary,
    "openai",
  );
}

/**
 * Direct Xiaomi MiMo Responses: injects reasoningEffort via the xiaomi namespace.
 * @ai-sdk/open-responses's providerOptionsName matches createOpenResponses({ name }), so it must be xiaomi, not openai.
 */
export function buildDirectXiaomiResponsesProviderOptions(
  config: Pick<OpenAiTransportConfig, "llmVendor" | "model">,
  reasoningEffort: string | undefined,
  reasoningSummary?: OpenResponsesReasoningSummary,
): Record<string, JsonObject> {
  if (config.llmVendor !== "xiaomi") {
    return {};
  }
  return buildXiaomiResponsesReasoningOptions(
    config.model,
    reasoningEffort,
    reasoningSummary,
    "xiaomi",
  );
}

/** Gateway Xiaomi MiMo Chat: injects thinking.type via the xiaomi namespace (not the openai namespace). */
export function buildGatewayXiaomiProviderOptions(
  config: Pick<OpenAiTransportConfig, "llmVendor" | "model" | "vendorExtendedThinking">,
): Record<string, JsonObject> {
  if (!isGatewayXiaomiModel(config.llmVendor, config.model)) {
    return {};
  }
  if (!isXiaomiThinkingSwitchEligibleModel(config.model)) {
    return {};
  }

  return {
    xiaomi: {
      thinking: {
        type: config.vendorExtendedThinking === false ? "disabled" : "enabled",
      },
    } as JsonObject,
  };
}

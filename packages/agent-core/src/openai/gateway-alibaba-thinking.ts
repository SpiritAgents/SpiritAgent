import type { JsonObject } from "../ports.js";
import type { OpenAiTransportConfig } from "./openai-compat.js";
import { parseGatewayUpstreamSlug } from "./gateway-code-completion-thinking.js";

export function isGatewayAlibabaModel(llmVendor: string | undefined, model: string): boolean {
  return llmVendor === "vercel-ai-gateway" && parseGatewayUpstreamSlug(model) === "alibaba";
}

/** Gateway Alibaba/Qwen: injects enableThinking via the alibaba namespace (AI SDK camelCase; not HTTP enable_thinking). */
export function buildGatewayAlibabaProviderOptions(
  config: Pick<OpenAiTransportConfig, "llmVendor" | "model" | "vendorExtendedThinking">,
): Record<string, JsonObject> {
  if (!isGatewayAlibabaModel(config.llmVendor, config.model)) {
    return {};
  }
  if (config.vendorExtendedThinking !== false) {
    return {};
  }

  return {
    alibaba: {
      enableThinking: false,
    } as JsonObject,
  };
}

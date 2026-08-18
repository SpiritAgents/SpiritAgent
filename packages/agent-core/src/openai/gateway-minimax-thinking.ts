import type { JsonObject } from "../ports.js";
import type { OpenAiTransportConfig } from "./openai-compat.js";
import { parseGatewayUpstreamSlug } from "./gateway-code-completion-thinking.js";

/** Docs: https://platform.minimax.io/docs/api-reference/text-openai-api — M3 uses adaptive/disabled. */
function normalizeMinimaxModelId(model: string): string {
  const normalized = model.trim().toLowerCase();
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
}

export function isGatewayMinimaxModel(llmVendor: string | undefined, model: string): boolean {
  return llmVendor === "vercel-ai-gateway" && parseGatewayUpstreamSlug(model) === "minimax";
}

/** M2.x cannot disable thinking; M3 supports disabled. */
export function isMinimaxM3ThinkingSwitchModel(model: string): boolean {
  const id = normalizeMinimaxModelId(model);
  return id.includes("m3") || id.includes("minimax-m3");
}

/**
 * Gateway MiniMax: injects thinking.type via the minimax namespace.
 * M3 does not return a displayable thinking stream under open-responses; see #170.
 */
export function buildGatewayMinimaxProviderOptions(
  config: Pick<OpenAiTransportConfig, "llmVendor" | "model" | "vendorExtendedThinking">,
): Record<string, JsonObject> {
  if (!isGatewayMinimaxModel(config.llmVendor, config.model)) {
    return {};
  }

  return {
    minimax: {
      thinking: {
        type: config.vendorExtendedThinking === false ? "disabled" : "adaptive",
      },
    } as JsonObject,
  };
}

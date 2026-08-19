import type { LlmTransportConfig } from "../provider-config.js";

export type ZaiSearchFlavor = "z-ai" | "zhipu-ai";

function zaiFlavorFromApiBase(baseUrl: string | undefined): ZaiSearchFlavor | undefined {
  const trimmed = baseUrl?.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const hostname = new URL(trimmed).hostname;
    if (hostname === "api.z.ai") {
      return "z-ai";
    }
    if (hostname === "open.bigmodel.cn") {
      return "zhipu-ai";
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Resolve the Z.ai / Zhipu AI search flavor from the vendor id, falling back to the API base host. */
export function resolveZaiSearchFlavor(
  config: LlmTransportConfig | undefined,
): ZaiSearchFlavor | undefined {
  if (!config) {
    return undefined;
  }

  const vendor = (config as { llmVendor?: string }).llmVendor;
  if (vendor === "z-ai" || vendor === "zhipu-ai") {
    return vendor;
  }

  return zaiFlavorFromApiBase((config as { baseUrl?: string }).baseUrl);
}

export function shouldUseZaiWebSearch(config: LlmTransportConfig | undefined): boolean {
  return resolveZaiSearchFlavor(config) !== undefined;
}

export function isZaiManagedWebSearchToolCall(toolName: string, config: unknown): boolean {
  return toolName === "web_search" && shouldUseZaiWebSearch(config as LlmTransportConfig);
}

import type { LlmTransportConfig } from "../provider-config.js";

function isKimiCodeApiBase(baseUrl: string | undefined): boolean {
  const trimmed = baseUrl?.trim();
  if (!trimmed) {
    return false;
  }

  try {
    const hostname = new URL(trimmed).hostname;
    return hostname === "api.kimi.com" || hostname === "api.kimi.ai";
  } catch {
    return false;
  }
}

export function shouldUseKimiCodeWebSearch(config: LlmTransportConfig | undefined): boolean {
  if (!config) {
    return false;
  }

  const vendor = (config as { llmVendor?: string }).llmVendor;
  if (vendor === "kimi-code") {
    return true;
  }
  // Symmetric with Formula excluding kimi-code: moonshot-ai does not use managed search even if baseUrl points at api.kimi.com / api.kimi.ai
  if (vendor === "moonshot-ai") {
    return false;
  }

  return isKimiCodeApiBase((config as { baseUrl?: string }).baseUrl);
}

export function isKimiCodeManagedWebSearchToolCall(toolName: string, config: unknown): boolean {
  return toolName === "web_search" && shouldUseKimiCodeWebSearch(config as LlmTransportConfig);
}

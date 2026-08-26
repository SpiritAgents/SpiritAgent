import type { LlmTransportConfig } from "../provider-config.js";

export const KIMI_CODE_CN_HOST = "api.kimi.com";
export const KIMI_CODE_INTL_HOST = "api.kimi.ai";

export function parseKimiCodeHostname(baseUrl?: string): string | undefined {
  const trimmed = baseUrl?.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return new URL(trimmed).hostname;
  } catch {
    return undefined;
  }
}

function isKimiCodeOfficialHost(hostname: string | undefined): boolean {
  return hostname === KIMI_CODE_CN_HOST || hostname === KIMI_CODE_INTL_HOST;
}

function isKimiCodeApiBase(baseUrl: string | undefined): boolean {
  return isKimiCodeOfficialHost(parseKimiCodeHostname(baseUrl));
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

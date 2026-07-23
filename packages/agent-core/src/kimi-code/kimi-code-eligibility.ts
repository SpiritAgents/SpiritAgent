import type { LlmTransportConfig } from '../provider-config.js';

function isKimiCodeApiBase(baseUrl: string | undefined): boolean {
  const trimmed = baseUrl?.trim();
  if (!trimmed) {
    return false;
  }

  try {
    return new URL(trimmed).hostname === 'api.kimi.com';
  } catch {
    return false;
  }
}

export function shouldUseKimiCodeWebSearch(config: LlmTransportConfig | undefined): boolean {
  if (!config) {
    return false;
  }

  const vendor = (config as { llmVendor?: string }).llmVendor;
  if (vendor === 'kimi-code') {
    return true;
  }
  // 与 Formula 排除 kimi-code 对称：moonshot-ai 即使 baseUrl 落在 api.kimi.com 也不走托管 search
  if (vendor === 'moonshot-ai') {
    return false;
  }

  return isKimiCodeApiBase((config as { baseUrl?: string }).baseUrl);
}

export function isKimiCodeManagedWebSearchToolCall(
  toolName: string,
  config: unknown,
): boolean {
  return toolName === 'web_search' && shouldUseKimiCodeWebSearch(config as LlmTransportConfig);
}

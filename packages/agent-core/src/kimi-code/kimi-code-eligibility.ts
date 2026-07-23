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

  return isKimiCodeApiBase((config as { baseUrl?: string }).baseUrl);
}

export function isKimiCodeManagedWebSearchToolCall(
  toolName: string,
  config: unknown,
): boolean {
  return toolName === 'web_search' && shouldUseKimiCodeWebSearch(config as LlmTransportConfig);
}

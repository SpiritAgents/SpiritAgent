import type { LlmTransportConfig } from '../provider-config.js';

function isStepfunApiBase(baseUrl: string | undefined): boolean {
  const trimmed = baseUrl?.trim();
  if (!trimmed) {
    return false;
  }

  try {
    return new URL(trimmed).hostname === 'api.stepfun.com';
  } catch {
    return false;
  }
}

export function shouldUseStepfunWebSearch(config: LlmTransportConfig | undefined): boolean {
  if (!config) {
    return false;
  }

  const vendor = (config as { llmVendor?: string }).llmVendor;
  if (vendor === 'stepfun') {
    return true;
  }

  return isStepfunApiBase((config as { baseUrl?: string }).baseUrl);
}

export function isStepfunManagedWebSearchToolCall(
  toolName: string,
  config: unknown,
): boolean {
  return toolName === 'web_search' && shouldUseStepfunWebSearch(config as LlmTransportConfig);
}

import type { JsonObject } from '../ports.js';
import {
  isOpenAiCompatibleTransportConfig,
  isOpenResponsesTransportConfig,
  type LlmTransportConfig,
} from '../provider-config.js';
import {
  resolveOpenResponsesSdkProvider,
  type OpenResponsesTransportConfig,
} from './responses-compat.js';

export const MOONSHOT_WEB_SEARCH_API_TOOL_NAME = '$web_search';
export const WEB_SEARCH_DISPLAY_TOOL_NAME = 'web_search';

export const PROVIDER_BUILTIN_WEB_SEARCH_REQUEST_KIND = 'spirit-provider-builtin-web-search';

export type ProviderWebSearchMode =
  | 'moonshot-builtin'
  | 'openai-sdk-web-search'
  | 'xai-sdk-web-search';

/**
 * Set true when xAI Responses accepts `xai.tools.webSearch()` alongside host function tools.
 * Phase 3 enables this after the coexistence spike.
 */
export const XAI_WEB_SEARCH_WITH_LOCAL_TOOLS_ENABLED = true;

export function shouldUseProviderWebSearch(config: LlmTransportConfig): boolean {
  return resolveProviderWebSearchMode(config) !== undefined;
}

export function resolveProviderWebSearchMode(
  config: LlmTransportConfig,
): ProviderWebSearchMode | undefined {
  if (isOpenResponsesTransportConfig(config)) {
    return resolveOpenResponsesWebSearchMode(config);
  }

  if (isOpenAiCompatibleTransportConfig(config) && config.llmVendor === 'moonshot-ai') {
    return 'moonshot-builtin';
  }

  return undefined;
}

function resolveOpenResponsesWebSearchMode(
  config: OpenResponsesTransportConfig,
): ProviderWebSearchMode | undefined {
  const provider = resolveOpenResponsesSdkProvider(config);
  if (config.llmVendor === 'openai' && provider === 'openai') {
    return 'openai-sdk-web-search';
  }

  if (
    config.llmVendor === 'xai'
    && provider === 'xai'
    && XAI_WEB_SEARCH_WITH_LOCAL_TOOLS_ENABLED
  ) {
    return 'xai-sdk-web-search';
  }

  return undefined;
}

export function shouldDisableMoonshotThinkingForWebSearch(config: LlmTransportConfig): boolean {
  return resolveProviderWebSearchMode(config) === 'moonshot-builtin';
}

/** Model-visible guidance when provider-native web search is available. */
export function buildProviderWebSearchPromptSection(): string {
  return [
    'Web search on this transport:',
    'Use the provider web search capability when you need current public information.',
    'Prefer web search over guessing facts that may have changed after your knowledge cutoff.',
    'Do not invent search tools or APIs that are not declared in this request.',
  ].join('\n');
}

export function isMoonshotBuiltinWebSearchToolName(name: string): boolean {
  return name === MOONSHOT_WEB_SEARCH_API_TOOL_NAME || name === WEB_SEARCH_DISPLAY_TOOL_NAME;
}

export function buildMoonshotBuiltinWebSearchToolDefinition(): JsonObject {
  return {
    type: 'builtin_function',
    function: {
      name: MOONSHOT_WEB_SEARCH_API_TOOL_NAME,
    },
  };
}

export function buildWebSearchResponsesTraceToolEntry(): JsonObject {
  return { type: 'web_search' };
}

export function isProviderBuiltinWebSearchToolRequest(request: unknown): boolean {
  return (
    typeof request === 'object'
    && request !== null
    && !Array.isArray(request)
    && (request as JsonObject).kind === PROVIDER_BUILTIN_WEB_SEARCH_REQUEST_KIND
  );
}

export function createProviderBuiltinWebSearchToolRequest(
  toolName: string,
  argumentsJson: string,
): JsonObject {
  return {
    kind: PROVIDER_BUILTIN_WEB_SEARCH_REQUEST_KIND,
    toolName,
    argumentsJson,
  };
}

/** xAI Responses rejects host function tools unless provider web search is enabled. */
export function xaiResponsesRejectsLocalFunctionTools(
  config: OpenResponsesTransportConfig,
  localFunctionToolCount: number,
): boolean {
  if (config.llmVendor !== 'xai' || localFunctionToolCount === 0) {
    return false;
  }

  return !shouldUseProviderWebSearch(config);
}

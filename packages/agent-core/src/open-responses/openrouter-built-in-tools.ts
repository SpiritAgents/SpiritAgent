import type { JsonObject, JsonValue } from '../ports.js';
import {
  isOpenAiCompatibleTransportConfig,
  isOpenResponsesTransportConfig,
  type LlmTransportConfig,
} from '../provider-config.js';

export const OPENROUTER_RESPONSES_BUILT_IN_TOOL_TYPES = ['web_search'] as const;

export type OpenRouterResponsesBuiltInToolType =
  (typeof OPENROUTER_RESPONSES_BUILT_IN_TOOL_TYPES)[number];

export const OPENROUTER_CHAT_WEB_PLUGIN_ID = 'web';

function openrouterLlmVendor(config: LlmTransportConfig): string | undefined {
  if (isOpenAiCompatibleTransportConfig(config) || isOpenResponsesTransportConfig(config)) {
    return config.llmVendor;
  }

  return undefined;
}

export function shouldUseOpenRouterBuiltInTools(config: LlmTransportConfig): boolean {
  if (openrouterLlmVendor(config) !== 'openrouter') {
    return false;
  }

  return isOpenAiCompatibleTransportConfig(config) || isOpenResponsesTransportConfig(config);
}

export function shouldUseOpenRouterChatCompletionsBuiltInTools(config: LlmTransportConfig): boolean {
  return isOpenAiCompatibleTransportConfig(config) && openrouterLlmVendor(config) === 'openrouter';
}

export function shouldUseOpenRouterResponsesBuiltInTools(config: LlmTransportConfig): boolean {
  return isOpenResponsesTransportConfig(config) && openrouterLlmVendor(config) === 'openrouter';
}

/** OpenRouter Chat Completions：联网走 `plugins`，非 Alibaba 的 extra_body.enable_search。 */
export function buildOpenRouterChatCompletionsPlugins(): JsonObject[] {
  return [{ id: OPENROUTER_CHAT_WEB_PLUGIN_ID }];
}

export function mergeOpenRouterChatCompletionsPlugins(
  existingPlugins: readonly JsonValue[],
): JsonValue[] {
  const merged = [...existingPlugins];
  const presentIds = new Set<string>();

  for (const plugin of merged) {
    const id = readOpenRouterPluginId(plugin);
    if (id) {
      presentIds.add(id);
    }
  }

  if (!presentIds.has(OPENROUTER_CHAT_WEB_PLUGIN_ID)) {
    merged.push({ id: OPENROUTER_CHAT_WEB_PLUGIN_ID });
  }

  return merged;
}

export function buildOpenRouterResponsesBuiltInTools(): JsonObject[] {
  return OPENROUTER_RESPONSES_BUILT_IN_TOOL_TYPES.map((type) => ({ type }));
}

export function mergeOpenRouterResponsesBuiltInTools(
  existingTools: readonly JsonValue[],
): JsonValue[] {
  const merged = [...existingTools];
  const presentTypes = new Set<string>();

  for (const tool of merged) {
    const type = readResponsesBuiltInToolType(tool);
    if (type) {
      presentTypes.add(type);
    }
  }

  for (const type of OPENROUTER_RESPONSES_BUILT_IN_TOOL_TYPES) {
    if (!presentTypes.has(type)) {
      merged.push({ type });
      presentTypes.add(type);
    }
  }

  return merged;
}

function readOpenRouterPluginId(plugin: JsonValue): string | undefined {
  if (typeof plugin !== 'object' || plugin === null || Array.isArray(plugin)) {
    return undefined;
  }

  const record = plugin as JsonObject;
  return typeof record.id === 'string' ? record.id : undefined;
}

function readResponsesBuiltInToolType(tool: JsonValue): string | undefined {
  if (typeof tool !== 'object' || tool === null || Array.isArray(tool)) {
    return undefined;
  }

  const record = tool as JsonObject;
  return typeof record.type === 'string' ? record.type : undefined;
}

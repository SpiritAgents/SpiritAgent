import type { JsonObject, JsonValue, LlmStreamEvent } from '../ports.js';
import { isJsonObject } from '../tool-agent.js';
import { ALIBABA_RESPONSES_BUILTIN_TOOL_TYPES } from './alibaba-native-tools.js';

export const RESPONSES_PROVIDER_BUILTIN_TOOL_NAMES = [
  ...ALIBABA_RESPONSES_BUILTIN_TOOL_TYPES,
] as const;

const OUTPUT_ITEM_TYPE_TO_TOOL_NAME: Record<string, (typeof RESPONSES_PROVIDER_BUILTIN_TOOL_NAMES)[number]> = {
  web_search_call: 'web_search',
  web_extractor_call: 'web_extractor',
  code_interpreter_call: 'code_interpreter',
};

export function responsesProviderBuiltinToolNameFromOutputItemType(
  outputItemType: string,
): (typeof RESPONSES_PROVIDER_BUILTIN_TOOL_NAMES)[number] | undefined {
  return OUTPUT_ITEM_TYPE_TO_TOOL_NAME[outputItemType];
}

export function isResponsesProviderBuiltinToolName(toolName: string): boolean {
  return (RESPONSES_PROVIDER_BUILTIN_TOOL_NAMES as readonly string[]).includes(toolName);
}

export type ResponsesProviderBuiltinToolStreamPhase = 'preview' | 'succeeded' | 'failed';

export function resolveResponsesProviderBuiltinToolStreamPhase(
  item: JsonObject,
): ResponsesProviderBuiltinToolStreamPhase {
  const status = typeof item.status === 'string' ? item.status.trim().toLowerCase() : '';
  if (
    status === 'completed' ||
    status === 'complete' ||
    status === 'succeeded' ||
    status === 'success'
  ) {
    return 'succeeded';
  }
  if (
    status === 'failed' ||
    status === 'cancelled' ||
    status === 'canceled' ||
    status === 'error' ||
    status === 'incomplete'
  ) {
    return 'failed';
  }
  return 'preview';
}

export function resolveResponsesProviderBuiltinToolStreamPhaseFromArgumentsJson(
  argumentsJson: string,
): ResponsesProviderBuiltinToolStreamPhase | undefined {
  try {
    const parsed = JSON.parse(argumentsJson) as JsonValue;
    if (!isJsonObject(parsed)) {
      return undefined;
    }
    return resolveResponsesProviderBuiltinToolStreamPhase(parsed);
  } catch {
    return undefined;
  }
}

export function buildResponsesProviderBuiltinToolArgumentsJson(item: JsonObject): string {
  const payload: JsonObject = {};
  const query = readStringField(item, 'query');
  const url = readStringField(item, 'url');
  const queries = item.queries;
  if (query) {
    payload.query = query;
  }
  if (url) {
    payload.url = url;
  }
  if (Array.isArray(queries)) {
    payload.queries = queries;
  }
  if (isJsonObject(item.action as JsonValue)) {
    payload.action = item.action as JsonObject;
  }
  if (typeof item.status === 'string') {
    payload.status = item.status;
  }
  return JSON.stringify(payload);
}

function readStringField(record: JsonObject, key: string): string | undefined {
  const value = record[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function accumulateResponsesProviderBuiltinToolPreviewsFromRawChunk(
  rawValue: unknown,
  nextPreviewIndex: number,
): { events: LlmStreamEvent[]; nextPreviewIndex: number } {
  if (!isJsonObject(rawValue as JsonValue) || typeof (rawValue as JsonObject).type !== 'string') {
    return { events: [], nextPreviewIndex };
  }

  const chunk = rawValue as JsonObject;
  const chunkType = chunk.type;
  if (chunkType !== 'response.output_item.added' && chunkType !== 'response.output_item.done') {
    return { events: [], nextPreviewIndex };
  }

  if (!isJsonObject(chunk.item as JsonValue)) {
    return { events: [], nextPreviewIndex };
  }

  const item = chunk.item as JsonObject;
  const itemType = typeof item.type === 'string' ? item.type : '';
  const toolName = responsesProviderBuiltinToolNameFromOutputItemType(itemType);
  if (!toolName) {
    return { events: [], nextPreviewIndex };
  }

  const callId =
    typeof item.id === 'string' && item.id.trim()
      ? item.id
      : typeof item.call_id === 'string' && item.call_id.trim()
        ? item.call_id
        : `provider-${toolName}-${nextPreviewIndex}`;

  return {
    events: [
      {
        kind: 'streaming-tool-preview',
        toolCallId: callId,
        toolName,
        argumentsJson: buildResponsesProviderBuiltinToolArgumentsJson(item),
      },
    ],
    nextPreviewIndex: chunkType === 'response.output_item.added' ? nextPreviewIndex + 1 : nextPreviewIndex,
  };
}

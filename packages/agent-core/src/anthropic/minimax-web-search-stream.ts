import type { TextStreamPart } from 'ai';

import type { JsonObject, JsonValue, LlmStreamEvent } from '../ports.js';
import { filterPendingHostToolCalls } from '../open-responses/sdk-provider-web-search-loop.js';
import { isResponsesBuiltInToolName } from '../open-responses/responses-built-in-tools.js';
import { resolveStreamingToolPreviewEmit } from '../tool-streaming-preview-gate.js';
import { isJsonObject } from '../tool-agent.js';
import {
  MINIMAX_WEB_SEARCH_SERVER_TOOL_NAME,
} from './minimax-server-tools.js';
import {
  buildMinimaxWebSearchPreviewArgumentsJson,
  buildMinimaxWebSearchSucceededArgumentsJson,
  parseMinimaxWebSearchResults,
  type MinimaxWebSearchResult,
} from './minimax-web-search-cards.js';

export const ANTHROPIC_ASSISTANT_CONTENT_BLOCKS_KEY = '_anthropicContentBlocks';

type MinimaxWebSearchPreviewState = {
  readyPreviewEmitted: boolean;
  lastPreviewArgsLen?: number;
  lastPreviewDetailSignature?: string;
};

export type MinimaxWebSearchStreamState = {
  executedProviderBuiltinToolCallIds: Set<string>;
  webSearchInputByCallId: Map<string, string>;
  webSearchPreviewStateByCallId: Map<string, MinimaxWebSearchPreviewState>;
  webSearchResultsByCallId: Map<string, readonly MinimaxWebSearchResult[]>;
  anthropicContentBlocks: JsonValue[];
  handledWebSearchValidationErrors: Set<string>;
};

export function createMinimaxWebSearchStreamState(): MinimaxWebSearchStreamState {
  return {
    executedProviderBuiltinToolCallIds: new Set<string>(),
    webSearchInputByCallId: new Map<string, string>(),
    webSearchPreviewStateByCallId: new Map<string, MinimaxWebSearchPreviewState>(),
    webSearchResultsByCallId: new Map<string, readonly MinimaxWebSearchResult[]>(),
    anthropicContentBlocks: [],
    handledWebSearchValidationErrors: new Set<string>(),
  };
}

export function isMinimaxProviderBuiltinWebSearchToolName(toolName: string): boolean {
  return toolName === MINIMAX_WEB_SEARCH_SERVER_TOOL_NAME && isResponsesBuiltInToolName(toolName);
}

export function shouldSuppressMinimaxWebSearchStreamError(
  error: unknown,
  state: MinimaxWebSearchStreamState,
): boolean {
  if (state.executedProviderBuiltinToolCallIds.size === 0) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  if (!message.includes('web_search_tool_result')) {
    return false;
  }

  const marker = 'web_search_tool_result';
  if (state.handledWebSearchValidationErrors.has(marker)) {
    return true;
  }
  state.handledWebSearchValidationErrors.add(marker);
  return true;
}

function readToolCallId(part: { toolCallId?: string; id?: string }): string | undefined {
  if (typeof part.toolCallId === 'string' && part.toolCallId.trim()) {
    return part.toolCallId;
  }
  if (typeof part.id === 'string' && part.id.trim()) {
    return part.id;
  }
  return undefined;
}

function readToolName(part: { toolName?: string }): string | undefined {
  return typeof part.toolName === 'string' && part.toolName.trim() ? part.toolName : undefined;
}

function tryParseQueryFromArgumentsJson(argumentsJson: string): string | undefined {
  try {
    const parsed = JSON.parse(argumentsJson) as JsonValue;
    if (!isJsonObject(parsed) || typeof parsed.query !== 'string') {
      return undefined;
    }
    const trimmed = parsed.query.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

function emitMinimaxWebSearchPreview(
  events: LlmStreamEvent[],
  toolCallId: string,
  argumentsJson: string,
  previewState: MinimaxWebSearchPreviewState,
): MinimaxWebSearchPreviewState {
  const decision = resolveStreamingToolPreviewEmit(
    MINIMAX_WEB_SEARCH_SERVER_TOOL_NAME,
    argumentsJson,
    previewState,
  );
  if (!decision.emit) {
    return previewState;
  }

  events.push({
    kind: 'streaming-tool-preview',
    toolCallId,
    toolName: MINIMAX_WEB_SEARCH_SERVER_TOOL_NAME,
    argumentsJson,
  });

  return decision.nextState;
}

function appendUniqueAnthropicContentBlock(
  state: MinimaxWebSearchStreamState,
  block: JsonValue,
): void {
  const serialized = JSON.stringify(block);
  const exists = state.anthropicContentBlocks.some((entry) => JSON.stringify(entry) === serialized);
  if (!exists) {
    state.anthropicContentBlocks.push(block);
  }
}

function handleRawMinimaxWebSearchChunk(
  rawValue: unknown,
  state: MinimaxWebSearchStreamState,
  events: LlmStreamEvent[],
): boolean {
  if (!isJsonObject(rawValue as JsonValue)) {
    return false;
  }

  const chunk = rawValue as JsonObject;
  if (chunk.type !== 'content_block_start') {
    return false;
  }

  const contentBlock = isJsonObject(chunk.content_block as JsonValue)
    ? (chunk.content_block as JsonObject)
    : undefined;
  if (!contentBlock || typeof contentBlock.type !== 'string') {
    return false;
  }

  if (contentBlock.type === 'server_tool_use') {
    appendUniqueAnthropicContentBlock(state, cloneJsonBlock(contentBlock));
    const toolCallId = typeof contentBlock.id === 'string' ? contentBlock.id : undefined;
    if (toolCallId && isJsonObject(contentBlock.input as JsonValue)) {
      state.webSearchInputByCallId.set(toolCallId, JSON.stringify(contentBlock.input));
    }
    return true;
  }

  if (contentBlock.type === 'web_search_tool_result') {
    appendUniqueAnthropicContentBlock(state, cloneJsonBlock(contentBlock));
    const toolCallId = typeof contentBlock.tool_use_id === 'string'
      ? contentBlock.tool_use_id
      : undefined;
    if (!toolCallId) {
      return true;
    }

    const results = parseMinimaxWebSearchResults(contentBlock.content);
    state.webSearchResultsByCallId.set(toolCallId, results);
    state.executedProviderBuiltinToolCallIds.add(toolCallId);

    const query =
      tryParseQueryFromArgumentsJson(state.webSearchInputByCallId.get(toolCallId) ?? '{}')
      ?? '';
    const succeededArgumentsJson = buildMinimaxWebSearchSucceededArgumentsJson(query, results);
    state.webSearchInputByCallId.set(toolCallId, succeededArgumentsJson);
    events.push({
      kind: 'streaming-tool-preview',
      toolCallId,
      toolName: MINIMAX_WEB_SEARCH_SERVER_TOOL_NAME,
      argumentsJson: succeededArgumentsJson,
    });
    return true;
  }

  if (contentBlock.type === 'text' && typeof contentBlock.text === 'string') {
    appendUniqueAnthropicContentBlock(state, { type: 'text', text: contentBlock.text });
    return false;
  }

  return false;
}

function cloneJsonBlock(value: JsonObject): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

export function handleMinimaxWebSearchStreamPart(
  part: TextStreamPart<any>,
  state: MinimaxWebSearchStreamState,
  events: LlmStreamEvent[],
): { handled: boolean; sawAnswerOrToolOutput: boolean } {
  const toolName = readToolName(part as { toolName?: string });
  const toolCallId = readToolCallId(part as { toolCallId?: string; id?: string });

  if (part.type === 'tool-input-start') {
    if (!toolCallId || !isMinimaxProviderBuiltinWebSearchToolName(toolName ?? '')) {
      return { handled: false, sawAnswerOrToolOutput: false };
    }
    state.webSearchInputByCallId.set(toolCallId, '');
    state.webSearchPreviewStateByCallId.set(toolCallId, { readyPreviewEmitted: false });
    return { handled: true, sawAnswerOrToolOutput: true };
  }

  if (part.type === 'tool-input-delta') {
    if (!toolCallId) {
      return { handled: false, sawAnswerOrToolOutput: false };
    }
    const currentInput = state.webSearchInputByCallId.get(toolCallId) ?? '';
    const delta = typeof part.delta === 'string' ? part.delta : '';
    const nextInput = currentInput + delta;
    state.webSearchInputByCallId.set(toolCallId, nextInput);

    const previewState = state.webSearchPreviewStateByCallId.get(toolCallId) ?? {
      readyPreviewEmitted: false,
    };
    const previewArgumentsJson = buildMinimaxWebSearchPreviewArgumentsJson(
      tryParseQueryFromArgumentsJson(nextInput) ?? '',
    );
    state.webSearchPreviewStateByCallId.set(
      toolCallId,
      emitMinimaxWebSearchPreview(events, toolCallId, previewArgumentsJson, previewState),
    );
    return { handled: true, sawAnswerOrToolOutput: true };
  }

  if (part.type === 'tool-input-end') {
    if (!toolCallId || !state.webSearchInputByCallId.has(toolCallId)) {
      return { handled: false, sawAnswerOrToolOutput: false };
    }
    return { handled: true, sawAnswerOrToolOutput: true };
  }

  if (part.type === 'tool-call') {
    if (!toolCallId || !isMinimaxProviderBuiltinWebSearchToolName(toolName ?? '')) {
      return { handled: false, sawAnswerOrToolOutput: false };
    }
    state.executedProviderBuiltinToolCallIds.add(toolCallId);
    const argumentsJson = JSON.stringify(part.input ?? {});
    state.webSearchInputByCallId.set(toolCallId, argumentsJson);
    const previewArgumentsJson = buildMinimaxWebSearchPreviewArgumentsJson(
      tryParseQueryFromArgumentsJson(argumentsJson) ?? '',
    );
    events.push({
      kind: 'streaming-tool-preview',
      toolCallId,
      toolName: MINIMAX_WEB_SEARCH_SERVER_TOOL_NAME,
      argumentsJson: previewArgumentsJson,
    });
    return { handled: true, sawAnswerOrToolOutput: true };
  }

  if (part.type === 'tool-error') {
    if (!toolCallId || !isMinimaxProviderBuiltinWebSearchToolName(toolName ?? '')) {
      return { handled: false, sawAnswerOrToolOutput: false };
    }
    if (state.webSearchResultsByCallId.has(toolCallId)) {
      return { handled: true, sawAnswerOrToolOutput: true };
    }
    state.executedProviderBuiltinToolCallIds.add(toolCallId);
    return { handled: true, sawAnswerOrToolOutput: true };
  }

  if (part.type === 'raw') {
    const rawValue = (part as { rawValue?: unknown }).rawValue;
    const sawToolBlock = handleRawMinimaxWebSearchChunk(rawValue, state, events);
    return { handled: sawToolBlock, sawAnswerOrToolOutput: sawToolBlock };
  }

  return { handled: false, sawAnswerOrToolOutput: false };
}

export function filterAnthropicHostToolCalls<T extends { id: string; name: string }>(
  calls: readonly T[],
  state: MinimaxWebSearchStreamState,
): T[] {
  if (state.executedProviderBuiltinToolCallIds.size === 0) {
    return [...calls];
  }

  const filteredIds = new Set(
    filterPendingHostToolCalls(
      calls.map((call) => ({
        id: call.id,
        name: call.name,
        argumentsJson: '',
      })),
      state.executedProviderBuiltinToolCallIds,
    ).map((call) => call.id),
  );

  return calls.filter((call) => filteredIds.has(call.id));
}

export function appendStreamingTextAnthropicBlock(
  state: MinimaxWebSearchStreamState,
  text: string,
): void {
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }

  const lastBlock = state.anthropicContentBlocks.at(-1);
  if (lastBlock !== undefined && isJsonObject(lastBlock as JsonValue)) {
    const textBlock = lastBlock as JsonObject;
    if (textBlock.type === 'text' && typeof textBlock.text === 'string') {
      textBlock.text = `${textBlock.text}${text}`;
      return;
    }
  }

  state.anthropicContentBlocks.push({ type: 'text', text });
}

export function buildMinimaxWebSearchAssistantMessageFields(
  state: MinimaxWebSearchStreamState,
  assistantContent: string,
): JsonObject {
  if (state.anthropicContentBlocks.length === 0 && assistantContent.trim()) {
    appendStreamingTextAnthropicBlock(state, assistantContent);
  }

  if (state.anthropicContentBlocks.length === 0) {
    return {};
  }

  return {
    [ANTHROPIC_ASSISTANT_CONTENT_BLOCKS_KEY]: state.anthropicContentBlocks.map(
      (block) => JSON.parse(JSON.stringify(block)) as JsonValue,
    ),
  };
}

export function readAnthropicAssistantContentBlocks(message: JsonObject): JsonValue[] | undefined {
  const blocks = message[ANTHROPIC_ASSISTANT_CONTENT_BLOCKS_KEY];
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return undefined;
  }
  return blocks;
}

export function anthropicAssistantContentBlocksToAiSdkParts(
  blocks: readonly JsonValue[],
): Array<Record<string, unknown>> {
  return blocks.flatMap((block) => {
    if (!isJsonObject(block) || typeof block.type !== 'string') {
      return [];
    }

    if (block.type === 'text' && typeof block.text === 'string') {
      return [{ type: 'text', text: block.text }];
    }

    if (block.type === 'server_tool_use') {
      return [{
        type: 'server_tool_use',
        id: block.id,
        name: block.name,
        input: block.input ?? {},
      }];
    }

    if (block.type === 'web_search_tool_result') {
      return [{
        type: 'web_search_tool_result',
        tool_use_id: block.tool_use_id,
        content: block.content ?? [],
      }];
    }

    return [block as Record<string, unknown>];
  });
}

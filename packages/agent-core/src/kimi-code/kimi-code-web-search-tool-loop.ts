import { getLlmFetch } from '../llm-fetch.js';
import type { LlmTransportConfig } from '../provider-config.js';
import type { ToolCallRequest } from '../ports.js';
import { readWebSearchQuery } from '../web-search/read-web-search-query.js';
import { buildStepfunWebSearchToolPreviewArgumentsJson } from '../stepfun/stepfun-spirit-ui.js';
import { isKimiCodeManagedWebSearchToolCall } from './kimi-code-eligibility.js';
import { invokeKimiCodeSearch } from './kimi-code-search-client.js';

export function readKimiCodeWebSearchQuery(argumentsJson: string): string {
  return readWebSearchQuery(argumentsJson);
}

export type KimiCodeWebSearchToolExecutionResult =
  | { kind: 'succeeded'; content: string; previewArgumentsJson: string }
  | { kind: 'failed'; error: string; previewArgumentsJson: string };

export async function executeKimiCodeWebSearchToolCall(
  config: LlmTransportConfig,
  call: Pick<ToolCallRequest, 'name' | 'argumentsJson'>,
  fetchImpl: typeof fetch = getLlmFetch(),
): Promise<KimiCodeWebSearchToolExecutionResult> {
  const query = readKimiCodeWebSearchQuery(call.argumentsJson);
  const apiKey = (config as { apiKey?: string }).apiKey ?? '';

  const searchResult = await invokeKimiCodeSearch(apiKey, { query }, fetchImpl);

  if (searchResult.kind === 'failed') {
    return {
      kind: 'failed',
      error: searchResult.error,
      previewArgumentsJson: buildStepfunWebSearchToolPreviewArgumentsJson({
        query,
        failed: true,
        status: 'failed',
      }),
    };
  }

  return {
    kind: 'succeeded',
    content: searchResult.content,
    previewArgumentsJson: buildStepfunWebSearchToolPreviewArgumentsJson({
      query,
      status: 'completed',
      outputExcerpt: searchResult.content,
    }),
  };
}

export function buildKimiCodeWebSearchStreamingPreviewArgumentsJson(
  config: LlmTransportConfig,
  toolName: string,
  argumentsJson: string,
): string | undefined {
  if (!isKimiCodeManagedWebSearchToolCall(toolName, config)) {
    return undefined;
  }

  return buildStepfunWebSearchToolPreviewArgumentsJson({
    query: readKimiCodeWebSearchQuery(argumentsJson),
    status: 'in_progress',
  });
}

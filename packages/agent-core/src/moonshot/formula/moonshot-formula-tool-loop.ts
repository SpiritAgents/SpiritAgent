import type { JsonObject } from '../../ports.js';
import { isJsonObject } from '../../tool-agent.js';
import type { OpenAiTransportConfig } from '../../openai/openai-compat.js';
import type { ToolCallRequest } from '../../ports.js';
import { tryExtractPartialWebSearchQuery } from '../../tool-streaming-preview-gate.js';
import { invokeFormulaFiber } from './formula-client.js';
import {
  isMoonshotFormulaWebSearchTool,
  shouldUseMoonshotFormulaWebSearch,
} from './formula-eligibility.js';
import { resolveMoonshotFormulaUri } from './formula-registry.js';
import { buildMoonshotFormulaToolPreviewArgumentsJson } from './formula-spirit-ui.js';

export function isMoonshotFormulaManagedToolCall(
  toolName: string,
  config: unknown,
): boolean {
  if (!shouldUseMoonshotFormulaWebSearch(config as OpenAiTransportConfig)) {
    return false;
  }

  return resolveMoonshotFormulaUri(toolName) !== undefined;
}

export function readMoonshotFormulaWebSearchQuery(argumentsJson: string): string {
  try {
    const parsed = JSON.parse(argumentsJson) as JsonObject;
    if (!isJsonObject(parsed)) {
      return '';
    }
    const query = parsed.query;
    return typeof query === 'string' ? query.trim() : '';
  } catch {
    return tryExtractPartialWebSearchQuery(argumentsJson) ?? '';
  }
}

export type MoonshotFormulaToolExecutionResult =
  | { kind: 'succeeded'; content: string; previewArgumentsJson: string }
  | { kind: 'failed'; error: string; previewArgumentsJson: string };

export async function executeMoonshotFormulaToolCall(
  config: OpenAiTransportConfig,
  call: Pick<ToolCallRequest, 'name' | 'argumentsJson'>,
): Promise<MoonshotFormulaToolExecutionResult> {
  const formulaUri = resolveMoonshotFormulaUri(call.name);
  if (!formulaUri) {
    return {
      kind: 'failed',
      error: `Unknown Moonshot Formula tool: ${call.name}`,
      previewArgumentsJson: buildMoonshotFormulaToolPreviewArgumentsJson({ failed: true }),
    };
  }

  const query = isMoonshotFormulaWebSearchTool(call.name, config)
    ? readMoonshotFormulaWebSearchQuery(call.argumentsJson)
    : '';

  const fiberResult = await invokeFormulaFiber(
    {
      apiKey: config.apiKey,
      ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
    },
    formulaUri,
    call.name,
    call.argumentsJson,
  );

  if (fiberResult.kind === 'failed') {
    return {
      kind: 'failed',
      error: fiberResult.error,
      previewArgumentsJson: buildMoonshotFormulaToolPreviewArgumentsJson({
        query,
        failed: true,
        status: 'failed',
      }),
    };
  }

  return {
    kind: 'succeeded',
    content: fiberResult.content,
    previewArgumentsJson: buildMoonshotFormulaToolPreviewArgumentsJson({
      query,
      status: 'completed',
    }),
  };
}

export function buildMoonshotFormulaStreamingToolPreviewArgumentsJson(
  config: OpenAiTransportConfig,
  toolName: string,
  argumentsJson: string,
): string | undefined {
  if (!isMoonshotFormulaWebSearchTool(toolName, config)) {
    return undefined;
  }

  return buildMoonshotFormulaToolPreviewArgumentsJson({
    query: readMoonshotFormulaWebSearchQuery(argumentsJson),
    status: 'in_progress',
  });
}

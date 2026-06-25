import { resolveHookSessionContext } from '../hooks/integration.js';
import { prepareToolOutputForAppend } from '../tool-output-truncation.js';

import { syncPreparedToolResultContentToHistory } from './tool-execution.js';
import type { AgentRuntimeOptions } from './types.js';
import type { LlmMessage } from '../ports.js';

export async function prepareRuntimeToolResultContentForAppend<
  Config,
  State,
  ToolRequest,
  TrustTarget = string,
>(
  options: AgentRuntimeOptions<Config, State, ToolRequest, TrustTarget>,
  toolCallId: string,
  content: string,
): Promise<string> {
  const sessionId = resolveHookSessionContext(options).sessionId;
  return prepareToolOutputForAppend({
    content,
    toolCallId,
    ...(sessionId !== undefined ? { sessionId } : {}),
    ...(options.persistToolOutputArchive !== undefined
      ? { persistArchive: options.persistToolOutputArchive }
      : {}),
  });
}

export async function prepareAndSyncRuntimeToolResultToHistory<
  Config,
  State,
  ToolRequest,
  TrustTarget = string,
>(
  runtime: {
    options: AgentRuntimeOptions<Config, State, ToolRequest, TrustTarget>;
    historyStore: LlmMessage[];
  },
  toolCallId: string,
  content: string,
): Promise<string> {
  const prepared = await prepareRuntimeToolResultContentForAppend(
    runtime.options,
    toolCallId,
    content,
  );
  syncPreparedToolResultContentToHistory(runtime, toolCallId, prepared);
  return prepared;
}

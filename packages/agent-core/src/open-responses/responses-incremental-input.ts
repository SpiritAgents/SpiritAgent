import type { JsonValue } from '../ports.js';
import { cloneJsonValue, isJsonObject } from '../tool-agent.js';
import {
  findAnchorIndexForResponseId,
  findPreviousResponseId,
} from './provider-state.js';
import {
  resolveOpenResponsesSdkProvider,
  type OpenResponsesTransportConfig,
} from './responses-compat.js';

export type ResponsesRoundInputMode = 'full' | 'incremental';

export interface ResponsesRoundInput {
  apiMessages: JsonValue[];
  previousResponseId?: string;
  mode: ResponsesRoundInputMode;
}

/** OpenAI / Azure 官方 SDK 路径支持 store + previous_response_id。 */
export function responsesUsesStoredState(config: OpenResponsesTransportConfig): boolean {
  const provider = resolveOpenResponsesSdkProvider(config);
  return provider === 'openai' || provider === 'azure';
}

export function buildResponsesRoundInput(
  requestMessages: readonly JsonValue[],
  config: OpenResponsesTransportConfig,
  stepIndex: number,
): ResponsesRoundInput {
  const cloned = requestMessages.map((message) => cloneJsonValue(message));

  if (!responsesUsesStoredState(config)) {
    return { apiMessages: cloned, mode: 'full' };
  }

  const previousResponseId = findPreviousResponseId(requestMessages);
  if (!previousResponseId) {
    return { apiMessages: cloned, mode: 'full' };
  }

  const anchorIndex = findAnchorIndexForResponseId(requestMessages, previousResponseId);
  if (anchorIndex < 0) {
    return { apiMessages: cloned, mode: 'full' };
  }

  let delta = requestMessages.slice(anchorIndex + 1).map((message) => cloneJsonValue(message));

  if (stepIndex === 1) {
    const systemMessage = requestMessages.find(
      (message) => isJsonObject(message) && message.role === 'system',
    );
    const deltaHasSystem = delta.some(
      (message) => isJsonObject(message) && message.role === 'system',
    );
    if (systemMessage && !deltaHasSystem) {
      delta = [cloneJsonValue(systemMessage), ...delta];
    }
  }

  return {
    apiMessages: delta,
    previousResponseId,
    mode: 'incremental',
  };
}

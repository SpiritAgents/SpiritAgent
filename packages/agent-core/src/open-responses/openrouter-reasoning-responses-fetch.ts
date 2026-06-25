import { getLlmFetch } from '../llm-fetch.js';
import type { JsonObject, JsonValue } from '../ports.js';
import { isJsonObject } from '../tool-agent.js';
import {
  patchResponsesRequestBodyForOpenRouterReasoning,
  shouldInjectOpenRouterClaudeReasoning,
} from '../openai/openrouter-anthropic-reasoning.js';
import type { OpenResponsesTransportConfig } from './responses-compat.js';

type FetchFn = typeof fetch;

export function createOpenRouterReasoningAwareFetch(
  config: OpenResponsesTransportConfig,
  baseFetch: FetchFn = getLlmFetch(),
): FetchFn {
  if (!shouldInjectOpenRouterClaudeReasoning(config)) {
    return baseFetch;
  }

  return async (input, init) => {
    const patchedInit = patchRequestInitBody(init, config);
    return baseFetch(input, patchedInit);
  };
}

function patchRequestInitBody(
  init: RequestInit | undefined,
  config: OpenResponsesTransportConfig,
): RequestInit | undefined {
  if (!init?.body || typeof init.body !== 'string') {
    return init;
  }

  try {
    const body = JSON.parse(init.body) as JsonObject;
    if (!isJsonObject(body as JsonValue)) {
      return init;
    }

    patchResponsesRequestBodyForOpenRouterReasoning(body, config);
    return {
      ...init,
      body: JSON.stringify(body),
    };
  } catch {
    return init;
  }
}

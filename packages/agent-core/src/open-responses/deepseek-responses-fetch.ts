import { getLlmFetch } from '../llm-fetch.js';
import type { JsonObject, JsonValue } from '../ports.js';
import { isJsonObject } from '../tool-agent.js';
import {
  mergeDeepSeekResponsesBuiltInTools,
  shouldUseDeepSeekResponsesBuiltInTools,
} from './deepseek-built-in-tools.js';
import {
  openResponsesReasoningEffort,
  type OpenResponsesTransportConfig,
} from './responses-compat.js';

type FetchFn = typeof fetch;

export function createDeepSeekResponsesAwareFetch(
  config: OpenResponsesTransportConfig,
  baseFetch: FetchFn = getLlmFetch(),
): FetchFn {
  if (!shouldUseDeepSeekResponsesBuiltInTools(config)) {
    return baseFetch;
  }

  return async (input, init) => {
    const requestUrl = readRequestUrl(input);
    if (!requestUrl.includes('/responses')) {
      return baseFetch(input, init);
    }

    const patchedInit = patchDeepSeekResponsesRequestInit(config, init);
    return baseFetch(input, patchedInit);
  };
}

function readRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

function patchDeepSeekResponsesRequestInit(
  config: OpenResponsesTransportConfig,
  init: RequestInit | undefined,
): RequestInit | undefined {
  if (!init?.body || typeof init.body !== 'string') {
    return init;
  }

  try {
    const body = JSON.parse(init.body) as JsonObject;
    if (!isJsonObject(body as JsonValue)) {
      return init;
    }

    const existingTools = Array.isArray(body.tools) ? body.tools : [];
    const effort = resolveDeepSeekResponsesReasoningEffort(config);
    const patched: JsonObject = {
      ...body,
      tools: mergeDeepSeekResponsesBuiltInTools(existingTools),
    };

    if (effort !== undefined) {
      patched.reasoning = { effort };
    }

    delete patched.store;
    delete patched.previous_response_id;

    return {
      ...init,
      body: JSON.stringify(patched),
    };
  } catch {
    return init;
  }
}

export function resolveDeepSeekResponsesReasoningEffort(
  config: Pick<OpenResponsesTransportConfig, 'reasoningEffort' | 'vendorExtendedThinking' | 'llmVendor' | 'model'>,
): string | undefined {
  if (config.vendorExtendedThinking === false) {
    return 'none';
  }

  return openResponsesReasoningEffort(config);
}

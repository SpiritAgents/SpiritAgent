import { getLlmFetch } from '../llm-fetch.js';
import type { JsonObject, JsonValue } from '../ports.js';
import { isJsonObject } from '../tool-agent.js';
import type { OpenAiTransportConfig } from '../openai/openai-compat.js';
import {
  buildTokenHubWebSearchRequestFields,
  shouldPatchTokenHubChatCompletions,
} from './tokenhub-web-search.js';

type FetchFn = typeof fetch;

export function createTokenHubChatCompletionsAwareFetch(
  config: OpenAiTransportConfig,
  baseFetch: FetchFn = getLlmFetch(),
): FetchFn {
  if (!shouldPatchTokenHubChatCompletions(config)) {
    return baseFetch;
  }

  return async (input, init) => {
    const requestUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : 'request';
    const patchedInit = patchTokenHubChatCompletionsRequestInit(config, init, requestUrl);
    return baseFetch(input, patchedInit);
  };
}

function patchTokenHubChatCompletionsRequestInit(
  config: OpenAiTransportConfig,
  init: RequestInit | undefined,
  requestUrl: string,
): RequestInit | undefined {
  if (!shouldPatchTokenHubChatCompletions(config)) {
    return init;
  }
  if (!requestUrl.includes('/chat/completions')) {
    return init;
  }
  if (!init?.body || typeof init.body !== 'string') {
    return init;
  }

  try {
    const body = JSON.parse(init.body) as JsonObject;
    if (!isJsonObject(body as JsonValue)) {
      return init;
    }

    return {
      ...init,
      body: JSON.stringify({
        ...body,
        ...buildTokenHubWebSearchRequestFields(),
      }),
    };
  } catch {
    return init;
  }
}

export function patchTokenHubChatCompletionsRequestBody(
  config: OpenAiTransportConfig,
  body: JsonObject,
  requestUrl: string,
): JsonObject {
  if (!shouldPatchTokenHubChatCompletions(config)) {
    return body;
  }
  if (!requestUrl.includes('/chat/completions')) {
    return body;
  }
  return {
    ...body,
    ...buildTokenHubWebSearchRequestFields(),
  };
}

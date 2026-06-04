/** OpenRouter POST /chat/completions：合并 `plugins: [{ id: 'web' }]`。 */
import type { JsonObject, JsonValue } from '../ports.js';
import { isJsonObject } from '../tool-agent.js';
import type { OpenAiTransportConfig } from '../openai/openai-compat.js';
import {
  mergeOpenRouterChatCompletionsPlugins,
  shouldUseOpenRouterChatCompletionsBuiltInTools,
} from './openrouter-built-in-tools.js';

type FetchFn = typeof fetch;

export function createOpenRouterChatCompletionsAwareFetch(
  config: OpenAiTransportConfig,
  baseFetch: FetchFn = globalThis.fetch,
): FetchFn {
  if (!shouldUseOpenRouterChatCompletionsBuiltInTools(config)) {
    return baseFetch;
  }

  return async (input, init) => {
    const requestUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : '';
    if (!requestUrl.includes('/chat/completions')) {
      return baseFetch(input, init);
    }

    const patchedInit = patchOpenRouterChatCompletionsRequestInit(init);
    return baseFetch(input, patchedInit);
  };
}

function patchOpenRouterChatCompletionsRequestInit(
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

    const existingPlugins = Array.isArray(body.plugins) ? body.plugins : [];
    return {
      ...init,
      body: JSON.stringify({
        ...body,
        plugins: mergeOpenRouterChatCompletionsPlugins(existingPlugins),
      }),
    };
  } catch {
    return init;
  }
}

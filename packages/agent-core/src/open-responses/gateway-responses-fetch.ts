// 备用：@ai-sdk/open-responses 会丢弃 provider tools。Gateway Web Search 主路径已改走 createGateway v3 language-model。
import { getLlmFetch } from '../llm-fetch.js';
import type { JsonObject, JsonValue } from '../ports.js';
import { isJsonObject } from '../tool-agent.js';
import {
  buildGatewayResponsesWebSearchToolRequestEntry,
  shouldUseGatewayWebSearch,
} from './gateway-web-search.js';
import type { OpenResponsesTransportConfig } from './responses-compat.js';

type FetchFn = typeof fetch;

export function createGatewayWebSearchAwareFetch(
  config: OpenResponsesTransportConfig,
  baseFetch: FetchFn = getLlmFetch(),
): FetchFn {
  if (!shouldUseGatewayWebSearch(config)) {
    return baseFetch;
  }

  return async (input, init) => {
    const patchedInit = patchGatewayWebSearchRequestInit(init);
    return baseFetch(input, patchedInit);
  };
}

export function mergeGatewayResponsesWebSearchTools(
  existingTools: readonly unknown[],
): JsonObject[] {
  const merged = [...existingTools];
  const gatewayTool = buildGatewayResponsesWebSearchToolRequestEntry();
  const alreadyPresent = merged.some((tool) => {
    if (!isJsonObject(tool as JsonValue)) {
      return false;
    }

    const record = tool as JsonObject;
    return record.id === gatewayTool.id
      || (record.type === 'provider' && record.id === gatewayTool.id);
  });
  if (!alreadyPresent) {
    merged.push(gatewayTool);
  }

  return merged as JsonObject[];
}

function patchGatewayWebSearchRequestInit(
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
    const mergedTools = mergeGatewayResponsesWebSearchTools(existingTools);
    return {
      ...init,
      body: JSON.stringify({
        ...body,
        tools: mergedTools,
      }),
    };
  } catch {
    return init;
  }
}

import { mergeLlmFetchInit } from './llm-fetch.js';

const CLOUDFLARE_AI_GATEWAY_ID_HEADER = 'cf-aig-gateway-id';

function tryParseJsonBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== 'string') {
    return undefined;
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requestHasFunctionTools(body: Record<string, unknown>): boolean {
  const tools = body.tools;
  if (!Array.isArray(tools) || tools.length === 0) {
    return false;
  }
  return tools.some((tool) => isJsonRecord(tool) && tool.type === 'function');
}

/**
 * CF REST `/v1/chat/completions` rejects function tools with non-`none` `reasoning_effort`
 * for some OpenAI reasoning models (e.g. `openai/gpt-5.5`).
 */
export function patchCloudflareAiGatewayChatCompletionsBody(
  body: Record<string, unknown>,
): Record<string, unknown> {
  if (!requestHasFunctionTools(body)) {
    return body;
  }
  const effort = body.reasoning_effort;
  if (effort === undefined || effort === null || effort === 'none') {
    return body;
  }
  return { ...body, reasoning_effort: 'none' };
}

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

/** Injects `cf-aig-gateway-id` on every outbound request for Cloudflare AI Gateway REST API. */
export function createCloudflareAiGatewayFetch(
  gatewayId: string,
  baseFetch: typeof fetch = fetch,
): typeof fetch {
  const normalizedGatewayId = gatewayId.trim();
  if (!normalizedGatewayId) {
    return baseFetch;
  }

  return async (input, init) => {
    const merged = mergeLlmFetchInit(init);
    const headers = new Headers(merged.headers);
    headers.set(CLOUDFLARE_AI_GATEWAY_ID_HEADER, normalizedGatewayId);

    let nextInit = merged;
    const requestUrl = resolveRequestUrl(input);
    if (
      merged.method?.toUpperCase() === 'POST'
      && requestUrl.includes('/chat/completions')
      && merged.body
    ) {
      const parsed = tryParseJsonBody(merged.body);
      if (isJsonRecord(parsed)) {
        const patched = patchCloudflareAiGatewayChatCompletionsBody(parsed);
        if (patched !== parsed) {
          nextInit = { ...merged, body: JSON.stringify(patched) };
        }
      }
    }

    return baseFetch(input, { ...nextInit, headers });
  };
}

export function wrapFetchForCloudflareAiGateway(
  gatewayId: string | undefined,
  baseFetch: typeof fetch,
): typeof fetch {
  const trimmed = gatewayId?.trim();
  if (!trimmed) {
    return baseFetch;
  }
  return createCloudflareAiGatewayFetch(trimmed, baseFetch);
}

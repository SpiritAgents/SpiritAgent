import { mergeLlmFetchInit } from './llm-fetch.js';

const CLOUDFLARE_AI_GATEWAY_ID_HEADER = 'cf-aig-gateway-id';

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
    return baseFetch(input, { ...merged, headers });
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

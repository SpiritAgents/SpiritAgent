import type { AnthropicTransportConfig } from '../anthropic/anthropic-compat.js';
import type { JsonObject } from '../ports.js';

export type MeituanAnthropicThinkingType = 'enabled' | 'disabled';

function isMeituanAnthropicMessagesUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'api.longcat.chat' && parsed.pathname.includes('/messages');
  } catch {
    return false;
  }
}

export function meituanAnthropicThinkingType(
  vendorExtendedThinking?: boolean,
): MeituanAnthropicThinkingType {
  return vendorExtendedThinking === false ? 'disabled' : 'enabled';
}

export function patchMeituanAnthropicRequestBody(
  body: JsonObject,
  config: Pick<
    AnthropicTransportConfig,
    'llmVendor' | 'supportsThinkingSwitch' | 'vendorExtendedThinking'
  >,
): JsonObject {
  if (config.llmVendor !== 'meituan' || config.supportsThinkingSwitch !== true) {
    return body;
  }

  const next: JsonObject = { ...body };
  delete next.thinking;
  next.thinking = {
    type: meituanAnthropicThinkingType(config.vendorExtendedThinking),
  };
  return next;
}

export function createMeituanAnthropicAwareFetch(
  fetchImpl: typeof fetch,
  config: Pick<
    AnthropicTransportConfig,
    'llmVendor' | 'supportsThinkingSwitch' | 'vendorExtendedThinking'
  >,
): typeof fetch {
  return async (input, init) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

    if (
      init?.method?.toUpperCase() === 'POST'
      && typeof init.body === 'string'
      && isMeituanAnthropicMessagesUrl(url)
    ) {
      try {
        const parsed = JSON.parse(init.body) as JsonObject;
        return fetchImpl(input, {
          ...init,
          body: JSON.stringify(patchMeituanAnthropicRequestBody(parsed, config)),
        });
      } catch {
        // Fall through to the original request when body is not JSON.
      }
    }

    return fetchImpl(input, init);
  };
}

export function isMeituanAnthropicThinkingSwitchConfig(
  config: Pick<AnthropicTransportConfig, 'llmVendor' | 'supportsThinkingSwitch'>,
): boolean {
  return config.llmVendor === 'meituan' && config.supportsThinkingSwitch === true;
}

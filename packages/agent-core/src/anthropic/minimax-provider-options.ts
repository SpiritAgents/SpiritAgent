import type { JsonObject } from '../ports.js';
import { isMinimaxM3ThinkingSwitchModel } from '../openai/gateway-minimax-thinking.js';
import type { AnthropicTransportConfig } from './anthropic-compat.js';

export function buildMinimaxProviderOptions(
  config: Pick<
    AnthropicTransportConfig,
    'llmVendor' | 'model' | 'vendorExtendedThinking'
  >,
): Record<string, JsonObject> {
  if (config.llmVendor !== 'minimax') {
    return {};
  }

  if (!isMinimaxM3ThinkingSwitchModel(config.model)) {
    return {};
  }

  const enabled = config.vendorExtendedThinking !== false;
  return {
    minimax: {
      thinking: {
        type: enabled ? 'adaptive' : 'disabled',
      },
    } as JsonObject,
  };
}

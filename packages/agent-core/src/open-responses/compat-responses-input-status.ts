import type { JsonObject, JsonValue } from '../ports.js';
import { isJsonObject } from '../tool-agent.js';
import type { OpenResponsesTransportConfig } from './responses-compat.js';

export function shouldPatchVolcengineResponsesInputItemStatus(
  config: Pick<OpenResponsesTransportConfig, 'llmVendor'>,
): boolean {
  return config.llmVendor === 'volcengine';
}

/** 火山方舟 Responses 重放历史时要求每条 input item 带 status，缺省按 completed 补齐。 */
export function patchVolcengineResponsesInputItemStatus(body: JsonObject): void {
  const input = body.input;
  if (!Array.isArray(input)) {
    return;
  }

  for (let index = 0; index < input.length; index += 1) {
    const rawItem = input[index];
    if (!isJsonObject(rawItem as JsonValue)) {
      continue;
    }

    const item = rawItem as JsonObject;
    if (typeof item.status === 'string' && item.status.trim().length > 0) {
      continue;
    }

    input[index] = {
      ...item,
      status: 'completed',
    };
  }
}

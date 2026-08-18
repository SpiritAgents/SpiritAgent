import type { JsonObject, JsonValue } from "../ports.js";
import { isArkLlmVendor } from "../ark/ark-provider.js";
import { isJsonObject } from "../tool-agent.js";
import type { OpenResponsesTransportConfig } from "./responses-compat.js";

export function shouldPatchArkResponsesInputItemStatus(
  config: Pick<OpenResponsesTransportConfig, "llmVendor">,
): boolean {
  return isArkLlmVendor(config.llmVendor);
}

/** Ark Responses requires every input item to carry a status when replaying history; missing ones default to completed. */
export function patchArkResponsesInputItemStatus(body: JsonObject): void {
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
    if (typeof item.status === "string" && item.status.trim().length > 0) {
      continue;
    }

    input[index] = {
      ...item,
      status: "completed",
    };
  }
}

/** @deprecated Use shouldPatchArkResponsesInputItemStatus */
export const shouldPatchVolcengineResponsesInputItemStatus = shouldPatchArkResponsesInputItemStatus;

/** @deprecated Use patchArkResponsesInputItemStatus */
export const patchVolcengineResponsesInputItemStatus = patchArkResponsesInputItemStatus;

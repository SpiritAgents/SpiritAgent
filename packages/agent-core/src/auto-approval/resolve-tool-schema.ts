import type { JsonObject, JsonValue } from '../ports.js';

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function resolveToolInputSchema(
  definitions: JsonValue,
  toolName: string,
): JsonObject | undefined {
  if (!Array.isArray(definitions)) {
    return undefined;
  }

  for (const entry of definitions) {
    if (!isJsonObject(entry)) {
      continue;
    }

    const fn = entry.function;
    if (
      isJsonObject(fn)
      && fn.name === toolName
      && isJsonObject(fn.parameters)
    ) {
      return fn.parameters;
    }

    if (
      entry.type === 'function'
      && entry.name === toolName
      && isJsonObject(entry.parameters)
    ) {
      return entry.parameters;
    }
  }

  return undefined;
}

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
    if (fn !== undefined && isJsonObject(fn)) {
      const parameters = fn.parameters;
      if (fn.name === toolName && parameters !== undefined && isJsonObject(parameters)) {
        return parameters;
      }
    }

    const parameters = entry.parameters;
    if (
      entry.type === 'function'
      && entry.name === toolName
      && parameters !== undefined
      && isJsonObject(parameters)
    ) {
      return parameters;
    }
  }

  return undefined;
}

import type { JsonValue } from './ports.js';

const UNKNOWN_TOOL_PREFIX = '未知工具:';

function isJsonObject(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toolDefinitionNameFromJson(value: JsonValue): string | undefined {
  if (!isJsonObject(value)) {
    return undefined;
  }

  const candidateFunction = value['function'];
  if (candidateFunction === undefined || !isJsonObject(candidateFunction)) {
    return undefined;
  }

  return typeof candidateFunction.name === 'string' ? candidateFunction.name : undefined;
}

export function toolNamesFromDefinitions(definitions: JsonValue): string[] {
  if (!Array.isArray(definitions)) {
    return [];
  }

  const names = new Set<string>();
  for (const definition of definitions) {
    const name = toolDefinitionNameFromJson(definition);
    if (name) {
      names.add(name);
    }
  }
  return [...names].sort((left, right) => left.localeCompare(right));
}

export function unknownToolErrorMessage(
  requestedName: string,
  availableNames: readonly string[],
): string {
  const trimmed = requestedName.trim();
  const unique = [
    ...new Set(availableNames.map((name) => name.trim()).filter((name) => name.length > 0)),
  ].sort((left, right) => left.localeCompare(right));

  if (unique.length === 0) {
    return `${UNKNOWN_TOOL_PREFIX} ${trimmed}`;
  }

  return `${UNKNOWN_TOOL_PREFIX} ${trimmed}。可用工具: ${unique.join(', ')}`;
}

export function throwUnknownToolError(
  requestedName: string,
  availableNames: readonly string[],
): never {
  throw new Error(unknownToolErrorMessage(requestedName, availableNames));
}

export function isUnknownToolErrorForName(message: string, requestedName: string): boolean {
  const trimmed = requestedName.trim();
  const prefix = `${UNKNOWN_TOOL_PREFIX} ${trimmed}`;
  return message === prefix || message.startsWith(`${prefix}。`);
}

export function enrichUnknownToolError(
  error: unknown,
  requestedName: string,
  availableNames: readonly string[],
): Error {
  if (!(error instanceof Error)) {
    return new Error(String(error));
  }
  if (!isUnknownToolErrorForName(error.message, requestedName)) {
    return error;
  }
  return new Error(unknownToolErrorMessage(requestedName, availableNames));
}

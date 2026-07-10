import type { JsonValue } from '../ports.js';
import type { RealtimeSessionConfig, RealtimeToolDefinition } from './types.js';
import type { ToolExecutor } from '../ports.js';

function isJsonObject(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: JsonValue | undefined): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

export function toRealtimeToolDefinitions(hostTools: JsonValue): RealtimeToolDefinition[] {
  if (!Array.isArray(hostTools)) {
    return [];
  }

  const seenNames = new Set<string>();
  const definitions: RealtimeToolDefinition[] = [];

  for (const entry of hostTools) {
    if (!isJsonObject(entry) || entry.type !== 'function') {
      continue;
    }

    const fn = entry.function;
    if (fn === undefined || !isJsonObject(fn)) {
      continue;
    }

    const name = readString(fn.name);
    if (!name || seenNames.has(name)) {
      continue;
    }

    const parameters = fn.parameters;
    if (parameters === undefined || !isJsonObject(parameters)) {
      continue;
    }

    seenNames.add(name);
    const description = readString(fn.description);
    definitions.push({
      type: 'function',
      name,
      parameters: parameters as Record<string, unknown>,
      ...(description ? { description } : {}),
    });
  }

  return definitions;
}

export function buildRealtimeSessionConfigWithTools(
  base: RealtimeSessionConfig,
  toolExecutor: ToolExecutor,
): RealtimeSessionConfig {
  const tools = toRealtimeToolDefinitions(toolExecutor.toolDefinitionsJson());
  return {
    ...base,
    ...(tools.length > 0 ? { tools } : {}),
  };
}

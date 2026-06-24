import type { JsonValue } from '../ports.js';
import { GET_DIAGNOSTICS_TOOL_NAME } from './constants.js';
import type { LspDiagnosticsToolRequest } from './types.js';

function normalizeDiagnosticsPaths(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const paths: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') {
      continue;
    }
    const trimmed = entry.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    paths.push(trimmed);
  }
  return paths;
}

export function isLspDiagnosticsToolRequest(value: JsonValue): value is LspDiagnosticsToolRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.name !== GET_DIAGNOSTICS_TOOL_NAME) {
    return false;
  }
  return normalizeDiagnosticsPaths(record.paths).length > 0;
}

export function requestFromGetDiagnosticsFunctionCall(
  name: string,
  argumentsJson: string,
): LspDiagnosticsToolRequest | undefined {
  if (name.trim() !== GET_DIAGNOSTICS_TOOL_NAME) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(argumentsJson) as unknown;
  } catch {
    throw new Error('get_diagnostics arguments must be valid JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('get_diagnostics arguments must be an object');
  }
  const paths = normalizeDiagnosticsPaths((parsed as Record<string, unknown>).paths);
  if (paths.length === 0) {
    throw new Error('get_diagnostics requires a non-empty paths array');
  }
  return { name: GET_DIAGNOSTICS_TOOL_NAME, paths };
}

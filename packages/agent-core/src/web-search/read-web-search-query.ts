import type { JsonObject } from '../ports.js';
import { isJsonObject } from '../tool-agent.js';
import { tryExtractPartialWebSearchQuery } from '../tool-streaming-preview-gate.js';

/** Read `query` from complete or in-flight web_search argument JSON. */
export function readWebSearchQuery(argumentsJson: string): string {
  try {
    const parsed = JSON.parse(argumentsJson) as JsonObject;
    if (!isJsonObject(parsed)) {
      return '';
    }
    const query = parsed.query;
    return typeof query === 'string' ? query.trim() : '';
  } catch {
    return tryExtractPartialWebSearchQuery(argumentsJson) ?? '';
  }
}

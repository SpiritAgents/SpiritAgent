import type { JsonObject } from '../ports.js';
import {
  WEB_SEARCH_TOOL_NAME,
  buildWebSearchToolDefinition,
} from '../web-search/web-search-tool-schema.js';

export const KIMI_CODE_WEB_SEARCH_TOOL_NAME = WEB_SEARCH_TOOL_NAME;

export function buildKimiCodeWebSearchToolDefinition(): JsonObject {
  return buildWebSearchToolDefinition({ includeResultCountN: false });
}

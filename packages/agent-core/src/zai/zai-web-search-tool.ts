import type { JsonObject } from "../ports.js";
import {
  WEB_SEARCH_TOOL_NAME,
  buildWebSearchToolDefinition,
} from "../web-search/web-search-tool-schema.js";

export const ZAI_WEB_SEARCH_TOOL_NAME = WEB_SEARCH_TOOL_NAME;

export function buildZaiWebSearchToolDefinition(): JsonObject {
  return buildWebSearchToolDefinition({
    includeMaxResults: true,
    maxResults: { min: 1, max: 50, default: 10 },
  });
}

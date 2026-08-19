import type { JsonObject } from "../ports.js";

export const WEB_SEARCH_TOOL_NAME = "web_search" as const;

export const WEB_SEARCH_TOOL_DESCRIPTION =
  "Search the web for up-to-date information. Returns page titles, URLs, snippets, and content.";

export const WEB_SEARCH_QUERY_PARAMETER: JsonObject = {
  type: "string",
  description: "Search query.",
};

export type WebSearchMaxResultsRange = {
  min: number;
  max: number;
  default: number;
};

const DEFAULT_MAX_RESULTS_RANGE: WebSearchMaxResultsRange = { min: 1, max: 20, default: 10 };

function buildMaxResultsParameter(range: WebSearchMaxResultsRange): JsonObject {
  return {
    type: "integer",
    minimum: range.min,
    maximum: range.max,
    description: `Maximum number of results to return (default ${range.default}).`,
  };
}

export function buildWebSearchToolDefinition(options: {
  includeMaxResults: boolean;
  maxResults?: WebSearchMaxResultsRange;
}): JsonObject {
  const properties: JsonObject = {
    query: WEB_SEARCH_QUERY_PARAMETER,
  };
  if (options.includeMaxResults) {
    properties.max_results = buildMaxResultsParameter(
      options.maxResults ?? DEFAULT_MAX_RESULTS_RANGE,
    );
  }

  return {
    type: "function",
    function: {
      name: WEB_SEARCH_TOOL_NAME,
      description: WEB_SEARCH_TOOL_DESCRIPTION,
      parameters: {
        type: "object",
        properties,
        required: ["query"],
        additionalProperties: false,
      },
    },
  };
}

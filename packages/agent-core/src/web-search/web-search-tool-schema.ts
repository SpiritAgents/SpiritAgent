import type { JsonObject } from '../ports.js';

export const WEB_SEARCH_TOOL_NAME = 'web_search' as const;

export const WEB_SEARCH_TOOL_DESCRIPTION =
  'Search the web for up-to-date information. Returns page titles, URLs, snippets, and content.';

export const WEB_SEARCH_QUERY_PARAMETER: JsonObject = {
  type: 'string',
  description: 'Search query.',
};

const WEB_SEARCH_RESULT_COUNT_N_PARAMETER: JsonObject = {
  type: 'integer',
  minimum: 1,
  maximum: 20,
  description: 'Maximum number of results to return (default 10).',
};

export function buildWebSearchToolDefinition(options: {
  includeResultCountN: boolean;
}): JsonObject {
  const properties: JsonObject = {
    query: WEB_SEARCH_QUERY_PARAMETER,
  };
  if (options.includeResultCountN) {
    properties.n = WEB_SEARCH_RESULT_COUNT_N_PARAMETER;
  }

  return {
    type: 'function',
    function: {
      name: WEB_SEARCH_TOOL_NAME,
      description: WEB_SEARCH_TOOL_DESCRIPTION,
      parameters: {
        type: 'object',
        properties,
        required: ['query'],
        additionalProperties: false,
      },
    },
  };
}

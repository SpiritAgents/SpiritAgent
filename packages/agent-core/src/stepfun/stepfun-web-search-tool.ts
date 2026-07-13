import type { JsonObject } from '../ports.js';

export const STEPFUN_WEB_SEARCH_TOOL_NAME = 'web_search' as const;

export function buildStepfunWebSearchToolDefinition(): JsonObject {
  return {
    type: 'function',
    function: {
      name: STEPFUN_WEB_SEARCH_TOOL_NAME,
      description:
        'Search the web for up-to-date information. Returns page titles, URLs, snippets, and content.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query.',
          },
          n: {
            type: 'integer',
            minimum: 1,
            maximum: 20,
            description: 'Maximum number of results to return (default 10).',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  };
}

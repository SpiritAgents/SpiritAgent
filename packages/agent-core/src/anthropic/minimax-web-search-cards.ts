import type { JsonObject, JsonValue } from '../ports.js';
import { isJsonObject } from '../tool-agent.js';
import { buildResponsesBuiltInToolArgumentsJson } from '../open-responses/responses-built-in-tools.js';

export type MinimaxWebSearchResult = {
  type: 'web_search_result';
  title?: string;
  url?: string;
  content?: string;
  page_age?: string;
};

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseMinimaxWebSearchResults(content: unknown): MinimaxWebSearchResult[] {
  if (!Array.isArray(content)) {
    return [];
  }

  return content.flatMap((entry) => {
    if (!isJsonObject(entry as JsonValue) || (entry as JsonObject).type !== 'web_search_result') {
      return [];
    }

    const record = entry as JsonObject;
    return [{
      type: 'web_search_result' as const,
      ...(readNonEmptyString(record.title) ? { title: readNonEmptyString(record.title) } : {}),
      ...(readNonEmptyString(record.url) ? { url: readNonEmptyString(record.url) } : {}),
      ...(readNonEmptyString(record.content) ? { content: readNonEmptyString(record.content) } : {}),
      ...(readNonEmptyString(record.page_age) ? { page_age: readNonEmptyString(record.page_age) } : {}),
    }];
  });
}

export function mapMinimaxWebSearchResultsToActionSources(
  results: readonly MinimaxWebSearchResult[],
): JsonObject[] {
  const sources: JsonObject[] = [];

  for (const result of results) {
    const url = readNonEmptyString(result.url);
    if (!url) {
      continue;
    }

    const source: JsonObject = { type: 'url', url };
    const title = readNonEmptyString(result.title);
    const snippet = readNonEmptyString(result.content);
    if (title) {
      source.title = title;
    }
    if (snippet) {
      source.snippet = snippet;
    }
    sources.push(source);
  }

  return sources;
}

export function buildMinimaxWebSearchPreviewArgumentsJson(query: string): string {
  const trimmedQuery = query.trim();
  return JSON.stringify(trimmedQuery ? { query: trimmedQuery } : {});
}

export function buildMinimaxWebSearchSucceededArgumentsJson(
  query: string,
  results: readonly MinimaxWebSearchResult[],
): string {
  const sources = mapMinimaxWebSearchResultsToActionSources(results);
  const item: JsonObject = {
    type: 'web_search_call',
    status: 'completed',
    action: {
      type: 'search',
      query: query.trim(),
      sources,
    },
  };
  return buildResponsesBuiltInToolArgumentsJson(item, 'web_search');
}

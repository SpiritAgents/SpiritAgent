import { getLlmFetch } from '../llm-fetch.js';

export const KIMI_CODE_SEARCH_URL = 'https://api.kimi.com/coding/v1/search';

type KimiCodeSearchResult = {
  url?: string;
  title?: string;
  date?: string;
  snippet?: string;
  content?: string;
  site_name?: string;
};

type KimiCodeSearchResponse = {
  search_results?: KimiCodeSearchResult[];
};

export type KimiCodeSearchInvokeResult =
  | { kind: 'succeeded'; content: string }
  | { kind: 'failed'; error: string };

export function formatKimiCodeSearchResults(results: readonly KimiCodeSearchResult[]): string {
  if (results.length === 0) {
    return 'No search results.';
  }

  return results
    .map((result, index) => {
      const lines = [`## ${index + 1}. ${result.title?.trim() || 'Untitled'}`];
      if (result.url?.trim()) {
        lines.push(`URL: ${result.url.trim()}`);
      }
      if (result.site_name?.trim()) {
        lines.push(`Site: ${result.site_name.trim()}`);
      }
      if (result.date?.trim()) {
        lines.push(`Time: ${result.date.trim()}`);
      }
      if (result.snippet?.trim()) {
        lines.push(`Snippet: ${result.snippet.trim()}`);
      }
      if (result.content?.trim()) {
        lines.push(`Content: ${result.content.trim()}`);
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

export async function invokeKimiCodeSearch(
  apiKey: string,
  body: { query: string },
  fetchImpl: typeof fetch = getLlmFetch(),
): Promise<KimiCodeSearchInvokeResult> {
  const query = body.query.trim();
  if (!query) {
    return { kind: 'failed', error: 'web_search requires a non-empty query.' };
  }

  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    return { kind: 'failed', error: 'Kimi Code search requires an API key.' };
  }

  try {
    const response = await fetchImpl(KIMI_CODE_SEARCH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${trimmedKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text_query: query }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const suffix = text.trim() ? `: ${text.trim()}` : '';
      return {
        kind: 'failed',
        error: `Kimi Code search failed (${response.status})${suffix}`,
      };
    }

    const json = (await response.json()) as KimiCodeSearchResponse;
    return {
      kind: 'succeeded',
      content: formatKimiCodeSearchResults(
        Array.isArray(json.search_results) ? json.search_results : [],
      ),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { kind: 'failed', error: message };
  }
}

import { getLlmFetch } from "../llm-fetch.js";
import type { ZaiSearchFlavor } from "./zai-eligibility.js";

type ZaiSearchResult = {
  title?: string;
  link?: string;
  content?: string;
  media?: string;
  publish_date?: string;
};

type ZaiSearchResponse = {
  search_result?: ZaiSearchResult[];
};

export type ZaiSearchInvokeResult =
  | { kind: "succeeded"; content: string }
  | { kind: "failed"; error: string };

export function formatZaiSearchResults(results: readonly ZaiSearchResult[]): string {
  if (results.length === 0) {
    return "No search results.";
  }

  return results
    .map((result, index) => {
      const lines = [`## ${index + 1}. ${result.title?.trim() || "Untitled"}`];
      if (result.link?.trim()) {
        lines.push(`URL: ${result.link.trim()}`);
      }
      if (result.media?.trim()) {
        lines.push(`Site: ${result.media.trim()}`);
      }
      if (result.publish_date?.trim()) {
        lines.push(`Time: ${result.publish_date.trim()}`);
      }
      if (result.content?.trim()) {
        lines.push(`Content: ${result.content.trim()}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

/** Z.ai exposes only `search-prime`; Zhipu AI defaults to `search_std`. */
function searchEngineForFlavor(flavor: ZaiSearchFlavor): string {
  return flavor === "z-ai" ? "search-prime" : "search_std";
}

export async function invokeZaiWebSearch(
  options: { apiKey: string; baseUrl: string; flavor: ZaiSearchFlavor },
  body: { query: string; count?: number },
  fetchImpl: typeof fetch = getLlmFetch(),
): Promise<ZaiSearchInvokeResult> {
  const query = body.query.trim();
  if (!query) {
    return { kind: "failed", error: "web_search requires a non-empty query." };
  }

  const trimmedKey = options.apiKey.trim();
  if (!trimmedKey) {
    return { kind: "failed", error: "Z.ai search requires an API key." };
  }

  const trimmedBase = options.baseUrl.trim().replace(/\/+$/, "");
  if (!trimmedBase) {
    return { kind: "failed", error: "Z.ai search requires a base URL." };
  }

  const payload: {
    search_engine: string;
    search_query: string;
    search_intent?: boolean;
    count?: number;
  } = {
    search_engine: searchEngineForFlavor(options.flavor),
    search_query: query,
  };
  // Zhipu AI (open.bigmodel.cn) requires search_intent; Z.ai rejects unknown fields.
  if (options.flavor === "zhipu-ai") {
    payload.search_intent = false;
  }
  if (body.count !== undefined && Number.isFinite(body.count)) {
    const count = Math.trunc(body.count);
    if (count >= 1 && count <= 50) {
      payload.count = count;
    }
  }

  try {
    const response = await fetchImpl(`${trimmedBase}/web_search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${trimmedKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const suffix = text.trim() ? `: ${text.trim()}` : "";
      return {
        kind: "failed",
        error: `Z.ai search failed (${response.status})${suffix}`,
      };
    }

    const json = (await response.json()) as ZaiSearchResponse;
    return {
      kind: "succeeded",
      content: formatZaiSearchResults(Array.isArray(json.search_result) ? json.search_result : []),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { kind: "failed", error: message };
  }
}

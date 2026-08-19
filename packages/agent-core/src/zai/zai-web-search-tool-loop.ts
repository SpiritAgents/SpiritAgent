import { getLlmFetch } from "../llm-fetch.js";
import type { JsonObject } from "../ports.js";
import { isJsonObject } from "../tool-agent.js";
import type { LlmTransportConfig } from "../provider-config.js";
import type { ToolCallRequest } from "../ports.js";
import { readWebSearchQuery } from "../web-search/read-web-search-query.js";
import { buildStepfunWebSearchToolPreviewArgumentsJson } from "../stepfun/stepfun-spirit-ui.js";
import { isZaiManagedWebSearchToolCall, resolveZaiSearchFlavor } from "./zai-eligibility.js";
import { invokeZaiWebSearch } from "./zai-search-client.js";

export function readZaiWebSearchQuery(argumentsJson: string): string {
  return readWebSearchQuery(argumentsJson);
}

function readZaiWebSearchResultCount(argumentsJson: string): number | undefined {
  try {
    const parsed = JSON.parse(argumentsJson) as JsonObject;
    if (!isJsonObject(parsed)) {
      return undefined;
    }
    const maxResults = parsed.max_results;
    if (typeof maxResults !== "number" || !Number.isFinite(maxResults)) {
      return undefined;
    }
    const truncated = Math.trunc(maxResults);
    if (truncated < 1 || truncated > 50) {
      return undefined;
    }
    return truncated;
  } catch {
    return undefined;
  }
}

export type ZaiWebSearchToolExecutionResult =
  | { kind: "succeeded"; content: string; previewArgumentsJson: string }
  | { kind: "failed"; error: string; previewArgumentsJson: string };

export async function executeZaiWebSearchToolCall(
  config: LlmTransportConfig,
  call: Pick<ToolCallRequest, "name" | "argumentsJson">,
  fetchImpl: typeof fetch = getLlmFetch(),
): Promise<ZaiWebSearchToolExecutionResult> {
  const query = readZaiWebSearchQuery(call.argumentsJson);
  const count = readZaiWebSearchResultCount(call.argumentsJson);
  const flavor = resolveZaiSearchFlavor(config);
  const apiKey = (config as { apiKey?: string }).apiKey ?? "";
  const baseUrl = (config as { baseUrl?: string }).baseUrl ?? "";

  const searchResult =
    flavor === undefined
      ? ({ kind: "failed", error: "Z.ai search requires a z-ai or zhipu-ai provider." } as const)
      : await invokeZaiWebSearch(
          { apiKey, baseUrl, flavor },
          { query, ...(count !== undefined ? { count } : {}) },
          fetchImpl,
        );

  if (searchResult.kind === "failed") {
    return {
      kind: "failed",
      error: searchResult.error,
      previewArgumentsJson: buildStepfunWebSearchToolPreviewArgumentsJson({
        query,
        failed: true,
        status: "failed",
      }),
    };
  }

  return {
    kind: "succeeded",
    content: searchResult.content,
    previewArgumentsJson: buildStepfunWebSearchToolPreviewArgumentsJson({
      query,
      status: "completed",
      outputExcerpt: searchResult.content,
    }),
  };
}

export function buildZaiWebSearchStreamingPreviewArgumentsJson(
  config: LlmTransportConfig,
  toolName: string,
  argumentsJson: string,
): string | undefined {
  if (!isZaiManagedWebSearchToolCall(toolName, config)) {
    return undefined;
  }

  return buildStepfunWebSearchToolPreviewArgumentsJson({
    query: readZaiWebSearchQuery(argumentsJson),
    status: "in_progress",
  });
}

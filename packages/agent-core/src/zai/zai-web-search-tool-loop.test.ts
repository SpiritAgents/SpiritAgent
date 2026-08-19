import assert from "node:assert/strict";
import test from "node:test";

import type { LlmTransportConfig } from "../provider-config.js";
import {
  buildZaiWebSearchStreamingPreviewArgumentsJson,
  executeZaiWebSearchToolCall,
} from "./zai-web-search-tool-loop.js";

const ZAI_CONFIG = {
  apiKey: "sk-test",
  model: "glm-5.2",
  llmVendor: "z-ai",
  baseUrl: "https://api.z.ai/api/paas/v4",
} as LlmTransportConfig;

function createCapturingFetch() {
  const captured: { url: string; body: Record<string, unknown> } = { url: "", body: {} };
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.url = typeof input === "string" ? input : input.toString();
    captured.body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        search_result: [{ title: "Hit", link: "https://hit.example", content: "Found it" }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;
  return { captured, fetchImpl };
}

test("executeZaiWebSearchToolCall forwards query and clamped count to the provider API", async () => {
  const { captured, fetchImpl } = createCapturingFetch();
  const execution = await executeZaiWebSearchToolCall(
    ZAI_CONFIG,
    { name: "web_search", argumentsJson: JSON.stringify({ query: "latest news", max_results: 30 }) },
    fetchImpl,
  );

  assert.equal(execution.kind, "succeeded");
  assert.equal(captured.url, "https://api.z.ai/api/paas/v4/web_search");
  assert.equal(captured.body.search_query, "latest news");
  assert.equal(captured.body.count, 30);
  assert.equal(captured.body.search_engine, "search-prime");
  if (execution.kind === "succeeded") {
    assert.match(execution.content, /Hit/);
    assert.match(execution.previewArgumentsJson, /latest news/);
  }
});

test("executeZaiWebSearchToolCall drops out-of-range max_results", async () => {
  const { captured, fetchImpl } = createCapturingFetch();
  const execution = await executeZaiWebSearchToolCall(
    ZAI_CONFIG,
    { name: "web_search", argumentsJson: JSON.stringify({ query: "q", max_results: 51 }) },
    fetchImpl,
  );

  assert.equal(execution.kind, "succeeded");
  assert.equal(captured.body.count, undefined);
});

test("executeZaiWebSearchToolCall sends search_intent for zhipu-ai", async () => {
  const { captured, fetchImpl } = createCapturingFetch();
  const execution = await executeZaiWebSearchToolCall(
    {
      apiKey: "sk-test",
      model: "glm-5.2",
      llmVendor: "zhipu-ai",
      baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    } as LlmTransportConfig,
    { name: "web_search", argumentsJson: JSON.stringify({ query: "q" }) },
    fetchImpl,
  );

  assert.equal(execution.kind, "succeeded");
  assert.equal(captured.body.search_engine, "search_std");
  assert.equal(captured.body.search_intent, false);
});

test("buildZaiWebSearchStreamingPreviewArgumentsJson only handles eligible web_search calls", () => {
  const preview = buildZaiWebSearchStreamingPreviewArgumentsJson(
    ZAI_CONFIG,
    "web_search",
    JSON.stringify({ query: "in flight" }),
  );
  assert.ok(preview);
  assert.match(preview, /in flight/);

  assert.equal(
    buildZaiWebSearchStreamingPreviewArgumentsJson(ZAI_CONFIG, "read_file", "{}"),
    undefined,
  );
  assert.equal(
    buildZaiWebSearchStreamingPreviewArgumentsJson(
      { apiKey: "k", model: "step-3.7-flash", llmVendor: "stepfun" } as LlmTransportConfig,
      "web_search",
      "{}",
    ),
    undefined,
  );
});

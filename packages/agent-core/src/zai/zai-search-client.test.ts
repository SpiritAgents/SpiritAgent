import assert from "node:assert/strict";
import { test } from "vitest";

import { formatZaiSearchResults, invokeZaiWebSearch } from "./zai-search-client.js";

function createCapturingFetch(responseBody: unknown, status = 200) {
  const captured: { url: string; body: unknown } = { url: "", body: undefined };
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.url = typeof input === "string" ? input : input.toString();
    captured.body = JSON.parse(String(init?.body));
    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return { captured, fetchImpl };
}

test("formatZaiSearchResults serializes result fields", () => {
  const formatted = formatZaiSearchResults([
    {
      title: "Example",
      link: "https://example.com",
      media: "Example Media",
      publish_date: "2026-01-01",
      content: "Body text",
    },
  ]);
  assert.match(formatted, /Example/);
  assert.match(formatted, /https:\/\/example\.com/);
  assert.match(formatted, /Site: Example Media/);
  assert.match(formatted, /Time: 2026-01-01/);
  assert.match(formatted, /Body text/);
});

test("formatZaiSearchResults reports empty results", () => {
  assert.equal(formatZaiSearchResults([]), "No search results.");
});

test("invokeZaiWebSearch posts search-prime without search_intent for z-ai", async () => {
  const { captured, fetchImpl } = createCapturingFetch({
    search_result: [{ title: "Hit", link: "https://hit.example", content: "Found it" }],
  });

  const result = await invokeZaiWebSearch(
    { apiKey: "sk-test", baseUrl: "https://api.z.ai/api/paas/v4", flavor: "z-ai" },
    { query: "latest news", count: 5 },
    fetchImpl,
  );

  assert.equal(result.kind, "succeeded");
  assert.equal(captured.url, "https://api.z.ai/api/paas/v4/web_search");
  assert.deepEqual(captured.body, {
    search_engine: "search-prime",
    search_query: "latest news",
    count: 5,
  });
  if (result.kind === "succeeded") {
    assert.match(result.content, /Hit/);
  }
});

test("invokeZaiWebSearch posts search_std with search_intent false for zhipu-ai", async () => {
  const { captured, fetchImpl } = createCapturingFetch({ search_result: [] });

  const result = await invokeZaiWebSearch(
    {
      apiKey: "sk-test",
      baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4/",
      flavor: "zhipu-ai",
    },
    { query: "财经新闻" },
    fetchImpl,
  );

  assert.equal(result.kind, "succeeded");
  assert.equal(captured.url, "https://open.bigmodel.cn/api/coding/paas/v4/web_search");
  assert.deepEqual(captured.body, {
    search_engine: "search_std",
    search_query: "财经新闻",
    search_intent: false,
  });
});

test("invokeZaiWebSearch clamps count to the 1-50 range", async () => {
  const { captured, fetchImpl } = createCapturingFetch({ search_result: [] });

  await invokeZaiWebSearch(
    { apiKey: "sk-test", baseUrl: "https://api.z.ai/api/paas/v4", flavor: "z-ai" },
    { query: "q", count: 50.7 },
    fetchImpl,
  );
  assert.deepEqual(captured.body, {
    search_engine: "search-prime",
    search_query: "q",
    count: 50,
  });

  await invokeZaiWebSearch(
    { apiKey: "sk-test", baseUrl: "https://api.z.ai/api/paas/v4", flavor: "z-ai" },
    { query: "q", count: 0 },
    fetchImpl,
  );
  assert.deepEqual(captured.body, { search_engine: "search-prime", search_query: "q" });
});

test("invokeZaiWebSearch rejects empty query and missing credentials", async () => {
  const emptyQuery = await invokeZaiWebSearch(
    { apiKey: "sk-test", baseUrl: "https://api.z.ai/api/paas/v4", flavor: "z-ai" },
    { query: "   " },
  );
  assert.equal(emptyQuery.kind, "failed");

  const missingKey = await invokeZaiWebSearch(
    { apiKey: " ", baseUrl: "https://api.z.ai/api/paas/v4", flavor: "z-ai" },
    { query: "q" },
  );
  assert.equal(missingKey.kind, "failed");

  const missingBase = await invokeZaiWebSearch(
    { apiKey: "sk-test", baseUrl: " ", flavor: "z-ai" },
    { query: "q" },
  );
  assert.equal(missingBase.kind, "failed");
});

test("invokeZaiWebSearch surfaces non-2xx responses", async () => {
  const { fetchImpl } = createCapturingFetch({ error: "bad request" }, 400);
  const result = await invokeZaiWebSearch(
    { apiKey: "sk-test", baseUrl: "https://api.z.ai/api/paas/v4", flavor: "z-ai" },
    { query: "q" },
    fetchImpl,
  );
  assert.equal(result.kind, "failed");
  if (result.kind === "failed") {
    assert.match(result.error, /\(400\)/);
  }
});

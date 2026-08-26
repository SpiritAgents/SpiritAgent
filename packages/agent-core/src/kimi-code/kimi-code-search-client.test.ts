import assert from "node:assert/strict";
import { test } from "vitest";

import {
  KIMI_CODE_CN_SEARCH_URL,
  KIMI_CODE_INTL_SEARCH_URL,
  formatKimiCodeSearchResults,
  invokeKimiCodeSearch,
  resolveKimiCodeSearchUrl,
} from "./kimi-code-search-client.js";

test("formatKimiCodeSearchResults serializes result fields", () => {
  const formatted = formatKimiCodeSearchResults([
    {
      title: "Example",
      url: "https://example.com",
      site_name: "example.com",
      snippet: "Snippet text",
      content: "Body text",
      date: "2026-01-01",
    },
  ]);
  assert.match(formatted, /Example/);
  assert.match(formatted, /https:\/\/example.com/);
  assert.match(formatted, /example.com/);
  assert.match(formatted, /Snippet text/);
  assert.match(formatted, /Body text/);
  assert.match(formatted, /2026-01-01/);
});

test("resolveKimiCodeSearchUrl follows the chat endpoint host", () => {
  assert.equal(resolveKimiCodeSearchUrl(), KIMI_CODE_INTL_SEARCH_URL);
  assert.equal(resolveKimiCodeSearchUrl("   "), KIMI_CODE_INTL_SEARCH_URL);
  assert.equal(
    resolveKimiCodeSearchUrl("https://api.kimi.ai/coding/v1"),
    KIMI_CODE_INTL_SEARCH_URL,
  );
  assert.equal(resolveKimiCodeSearchUrl("https://api.kimi.ai/coding"), KIMI_CODE_INTL_SEARCH_URL);
  assert.equal(resolveKimiCodeSearchUrl("https://api.kimi.com/coding/v1"), KIMI_CODE_CN_SEARCH_URL);
  assert.equal(resolveKimiCodeSearchUrl("https://api.kimi.com/coding"), KIMI_CODE_CN_SEARCH_URL);
  assert.equal(
    resolveKimiCodeSearchUrl("https://example.test/coding/v1"),
    KIMI_CODE_INTL_SEARCH_URL,
  );
});

test("invokeKimiCodeSearch posts text_query to coding/v1/search", async () => {
  let capturedUrl = "";
  let capturedBody: unknown;
  let capturedAuth = "";
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = typeof input === "string" ? input : input.toString();
    capturedBody = JSON.parse(String(init?.body));
    const headers = new Headers(init?.headers);
    capturedAuth = headers.get("Authorization") ?? "";
    return new Response(
      JSON.stringify({
        search_results: [{ title: "Hit", url: "https://hit.example", snippet: "Found it" }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  const result = await invokeKimiCodeSearch("sk-test", { query: "latest news" }, fetchImpl);
  assert.equal(result.kind, "succeeded");
  assert.equal(capturedUrl, KIMI_CODE_INTL_SEARCH_URL);
  assert.equal(capturedAuth, "Bearer sk-test");
  assert.deepEqual(capturedBody, { text_query: "latest news" });
  if (result.kind === "succeeded") {
    assert.match(result.content, /Hit/);
  }

  const chinaResult = await invokeKimiCodeSearch(
    "sk-test",
    { query: "latest news" },
    fetchImpl,
    "https://api.kimi.com/coding",
  );
  assert.equal(chinaResult.kind, "succeeded");
  assert.equal(capturedUrl, KIMI_CODE_CN_SEARCH_URL);
});

test("invokeKimiCodeSearch rejects empty query", async () => {
  const result = await invokeKimiCodeSearch("sk-test", { query: "   " });
  assert.equal(result.kind, "failed");
});

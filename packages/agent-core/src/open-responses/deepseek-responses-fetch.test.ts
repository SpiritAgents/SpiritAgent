import assert from "node:assert/strict";
import test from "node:test";

import {
  createDeepSeekResponsesAwareFetch,
  resolveDeepSeekResponsesReasoningEffort,
} from "./deepseek-responses-fetch.js";
import type { OpenResponsesTransportConfig } from "./responses-compat.js";

const deepseekResponsesConfig: OpenResponsesTransportConfig = {
  transportKind: "open-responses",
  apiKey: "test-key",
  model: "deepseek-v4-flash",
  baseUrl: "https://api.deepseek.com",
  llmVendor: "deepseek",
};

test("deepseek responses fetch merges web_search builtin tool", async () => {
  let capturedBody: Record<string, unknown> | undefined;
  const baseFetch: typeof fetch = async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response("{}", { status: 200 });
  };

  const fetch = createDeepSeekResponsesAwareFetch(deepseekResponsesConfig, baseFetch);
  await fetch("https://api.deepseek.com/responses", {
    method: "POST",
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      input: [],
      tools: [{ type: "function", name: "demo_lookup" }],
    }),
  });

  const tools = capturedBody?.tools as Array<{ type?: string }> | undefined;
  assert.ok(tools?.some((tool) => tool.type === "web_search"));
  assert.equal(
    tools?.some((tool) => tool.type === "web_search_2025_08_26"),
    false,
  );
  assert.equal(
    tools?.some((tool) => tool.type === "code_interpreter"),
    false,
  );
  assert.ok(tools?.some((tool) => tool.type === "function"));
});

test("deepseek responses fetch maps reasoning effort and strips store fields", async () => {
  let capturedBody: Record<string, unknown> | undefined;
  const baseFetch: typeof fetch = async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response("{}", { status: 200 });
  };

  const fetch = createDeepSeekResponsesAwareFetch(
    {
      ...deepseekResponsesConfig,
      reasoningEffort: "high",
    },
    baseFetch,
  );
  await fetch("https://api.deepseek.com/responses", {
    method: "POST",
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      input: [],
      store: true,
      previous_response_id: "resp_old",
    }),
  });

  assert.deepEqual(capturedBody?.reasoning, { effort: "high" });
  assert.equal("store" in (capturedBody ?? {}), false);
  assert.equal("previous_response_id" in (capturedBody ?? {}), false);
});

test("deepseek responses fetch disables thinking via vendorExtendedThinking", async () => {
  let capturedBody: Record<string, unknown> | undefined;
  const baseFetch: typeof fetch = async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response("{}", { status: 200 });
  };

  const fetch = createDeepSeekResponsesAwareFetch(
    {
      ...deepseekResponsesConfig,
      reasoningEffort: "high",
      vendorExtendedThinking: false,
    },
    baseFetch,
  );
  await fetch("https://api.deepseek.com/responses", {
    method: "POST",
    body: JSON.stringify({ model: "deepseek-v4-flash", input: [] }),
  });

  assert.deepEqual(capturedBody?.reasoning, { effort: "none" });
});

test("deepseek responses fetch ignores non-responses URLs", async () => {
  let capturedBody: Record<string, unknown> | undefined;
  const baseFetch: typeof fetch = async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response("{}", { status: 200 });
  };

  const fetch = createDeepSeekResponsesAwareFetch(deepseekResponsesConfig, baseFetch);
  await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify({ model: "deepseek-v4-flash", messages: [] }),
  });

  assert.equal(capturedBody?.tools, undefined);
  assert.equal(capturedBody?.reasoning, undefined);
});

test("resolveDeepSeekResponsesReasoningEffort maps vendorExtendedThinking false to none", () => {
  assert.equal(
    resolveDeepSeekResponsesReasoningEffort({
      llmVendor: "deepseek",
      model: "deepseek-v4-flash",
      reasoningEffort: "max",
      vendorExtendedThinking: false,
    }),
    "none",
  );
  assert.equal(
    resolveDeepSeekResponsesReasoningEffort({
      llmVendor: "deepseek",
      model: "deepseek-v4-flash",
      reasoningEffort: "max",
    }),
    "max",
  );
});

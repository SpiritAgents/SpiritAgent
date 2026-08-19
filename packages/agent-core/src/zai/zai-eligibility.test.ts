import assert from "node:assert/strict";
import test from "node:test";

import {
  isZaiManagedWebSearchToolCall,
  resolveZaiSearchFlavor,
  shouldUseZaiWebSearch,
} from "./zai-eligibility.js";
import { buildZaiWebSearchToolDefinition } from "./zai-web-search-tool.js";

test("shouldUseZaiWebSearch matches z-ai and zhipu-ai vendors", () => {
  assert.equal(shouldUseZaiWebSearch({ apiKey: "k", model: "glm-5.2", llmVendor: "z-ai" }), true);
  assert.equal(
    shouldUseZaiWebSearch({ apiKey: "k", model: "glm-5.2", llmVendor: "zhipu-ai" }),
    true,
  );
});

test("shouldUseZaiWebSearch falls back to the api base host", () => {
  assert.equal(
    shouldUseZaiWebSearch({
      transportKind: "openai-compatible",
      apiKey: "k",
      model: "glm-5.2",
      baseUrl: "https://api.z.ai/api/paas/v4",
    }),
    true,
  );
  assert.equal(
    shouldUseZaiWebSearch({
      transportKind: "openai-compatible",
      apiKey: "k",
      model: "glm-5.2",
      baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
    }),
    true,
  );
});

test("shouldUseZaiWebSearch rejects other vendors and hosts", () => {
  assert.equal(
    shouldUseZaiWebSearch({ apiKey: "k", model: "step-3.7-flash", llmVendor: "stepfun" }),
    false,
  );
  assert.equal(
    shouldUseZaiWebSearch({
      apiKey: "k",
      model: "kimi-k2.5",
      baseUrl: "https://api.kimi.com/coding/v1",
    }),
    false,
  );
  assert.equal(shouldUseZaiWebSearch(undefined), false);
});

test("resolveZaiSearchFlavor prefers the vendor over the api base host", () => {
  assert.equal(
    resolveZaiSearchFlavor({
      apiKey: "k",
      model: "glm-5.2",
      llmVendor: "zhipu-ai",
      baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    }),
    "zhipu-ai",
  );
  assert.equal(
    resolveZaiSearchFlavor({
      apiKey: "k",
      model: "glm-5.2",
      baseUrl: "https://api.z.ai/api/coding/paas/v4",
    }),
    "z-ai",
  );
  assert.equal(resolveZaiSearchFlavor({ apiKey: "k", model: "glm-5.2" }), undefined);
});

test("isZaiManagedWebSearchToolCall matches web_search only when eligible", () => {
  const config = { apiKey: "k", model: "glm-5.2", llmVendor: "z-ai" as const };
  assert.equal(isZaiManagedWebSearchToolCall("web_search", config), true);
  assert.equal(isZaiManagedWebSearchToolCall("read_file", config), false);
});

test("buildZaiWebSearchToolDefinition exposes query and a 1-50 max_results", () => {
  const definition = buildZaiWebSearchToolDefinition() as {
    function: {
      name: string;
      parameters: {
        properties: Record<string, { minimum: number; maximum: number }>;
        required: string[];
      };
    };
  };
  assert.equal(definition.function.name, "web_search");
  assert.deepEqual(definition.function.parameters.required, ["query"]);
  assert.ok(definition.function.parameters.properties.query);
  const maxResults = definition.function.parameters.properties.max_results;
  assert.ok(maxResults);
  assert.equal(maxResults.minimum, 1);
  assert.equal(maxResults.maximum, 50);
});

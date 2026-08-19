import assert from "node:assert/strict";
import { test } from "vitest";

import { buildWebSearchToolDefinition } from "./web-search-tool-schema.js";

type MaxResultsParameter = {
  type: string;
  minimum: number;
  maximum: number;
  description: string;
};

function readMaxResults(definition: unknown): MaxResultsParameter {
  const typed = definition as {
    function: { parameters: { properties: { max_results: MaxResultsParameter } } };
  };
  return typed.function.parameters.properties.max_results;
}

test("buildWebSearchToolDefinition defaults max_results to the 1-20 range", () => {
  const maxResults = readMaxResults(buildWebSearchToolDefinition({ includeMaxResults: true }));
  assert.equal(maxResults.type, "integer");
  assert.equal(maxResults.minimum, 1);
  assert.equal(maxResults.maximum, 20);
  assert.equal(maxResults.description, "Maximum number of results to return (default 10).");
});

test("buildWebSearchToolDefinition honors a provider-supplied max_results range", () => {
  const maxResults = readMaxResults(
    buildWebSearchToolDefinition({
      includeMaxResults: true,
      maxResults: { min: 1, max: 50, default: 10 },
    }),
  );
  assert.equal(maxResults.minimum, 1);
  assert.equal(maxResults.maximum, 50);
  assert.equal(maxResults.description, "Maximum number of results to return (default 10).");
});

test("buildWebSearchToolDefinition omits max_results when not requested", () => {
  const definition = buildWebSearchToolDefinition({ includeMaxResults: false }) as {
    function: { parameters: { properties: Record<string, unknown> } };
  };
  assert.equal(definition.function.parameters.properties.max_results, undefined);
});

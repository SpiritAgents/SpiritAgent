import assert from "node:assert/strict";
import { test } from "vitest";

import type { JsonValue } from "./ports.js";
import {
  applyHostToolDescriptionHints,
  buildPlanModeHostToolDefinitions,
  type HostToolDescriptionHint,
} from "./host-tools.js";
import { isJsonObject } from "./tool-agent.js";

function readToolDescription(definition: JsonValue): string {
  assert.ok(isJsonObject(definition));
  const fn = definition.function;
  assert.ok(isJsonObject(fn));
  return String(fn.description);
}

function readParameterDescription(definition: JsonValue, parameterName: string): string {
  assert.ok(isJsonObject(definition));
  const fn = definition.function;
  assert.ok(isJsonObject(fn));
  const parameters = fn.parameters;
  assert.ok(isJsonObject(parameters));
  const properties = parameters.properties;
  assert.ok(isJsonObject(properties));
  const property = properties[parameterName];
  assert.ok(isJsonObject(property));
  return String(property.description);
}

const mermaidHint: HostToolDescriptionHint = {
  toolName: "create_plan",
  parameterName: "content",
  text: "If architecture or dataflow is non-obvious, include one short mermaid diagram; the host renders it.",
};

function applyHints(definitions: JsonValue[], hints: HostToolDescriptionHint[]): JsonValue[] {
  return applyHostToolDescriptionHints(definitions, hints) as JsonValue[];
}

test("applyHostToolDescriptionHints appends to the target parameter description", () => {
  const definitions = buildPlanModeHostToolDefinitions();
  const hinted = applyHints(definitions, [mermaidHint])[0]!;
  const description = readParameterDescription(hinted, "content");
  assert.match(description, /Phase 1/);
  assert.match(description, /one short mermaid diagram/);
  // Other parameters stay untouched.
  assert.equal(
    readParameterDescription(hinted, "name"),
    readParameterDescription(definitions[0]!, "name"),
  );
});

test("applyHostToolDescriptionHints appends to the tool description without parameterName", () => {
  const definitions = buildPlanModeHostToolDefinitions();
  const hinted = applyHints(definitions, [{ toolName: "create_plan", text: "Host note." }])[0]!;
  const description = readToolDescription(hinted);
  assert.match(description, /implementation plan/);
  assert.match(description, /Host note\.$/);
});

test("applyHostToolDescriptionHints ignores unknown tools and parameters", () => {
  const definitions = buildPlanModeHostToolDefinitions();
  const hinted = applyHints(definitions, [
    { toolName: "does_not_exist", text: "ignored" },
    { toolName: "create_plan", parameterName: "missing_param", text: "ignored" },
  ]);
  assert.deepEqual(hinted, definitions);
});

test("applyHostToolDescriptionHints does not mutate input definitions", () => {
  const definitions = buildPlanModeHostToolDefinitions();
  const before = readParameterDescription(definitions[0]!, "content");
  applyHostToolDescriptionHints(definitions, [mermaidHint]);
  assert.equal(readParameterDescription(definitions[0]!, "content"), before);
});

test("applyHostToolDescriptionHints returns input array when no hints", () => {
  const definitions = buildPlanModeHostToolDefinitions();
  assert.equal(applyHostToolDescriptionHints(definitions, []), definitions);
});

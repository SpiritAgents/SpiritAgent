import assert from "node:assert/strict";
import { test } from "vitest";

import {
  buildOpenResponsesRequestTrace,
  isGatewayOpenAiRoutedModel,
  normalizeGatewayOpenAiModelId,
  openResponsesReasoningTrace,
  resolveAzureResourceName,
  resolveOpenResponsesLanguageModelId,
  resolveOpenResponsesReasoningSummary,
  resolveOpenResponsesSdkProvider,
} from "./responses-compat.js";
import { extractAzureResourceNameFromApiBase } from "../azure-resource.js";

test("normalizeGatewayOpenAiModelId", () => {
  assert.equal(normalizeGatewayOpenAiModelId("openai/gpt-5.1"), "gpt-5.1");
  assert.equal(normalizeGatewayOpenAiModelId("anthropic/claude-sonnet-4"), undefined);
});

test("resolveOpenResponsesSdkProvider gateway openai route stays open-responses for reasoning", () => {
  // Gateway-routed OpenAI models must NOT use `@ai-sdk/openai` (which strips the
  // `openai/` prefix and suppresses gateway reasoning streaming). Default to the
  // generic open-responses provider.
  assert.equal(
    resolveOpenResponsesSdkProvider({
      llmVendor: "vercel-ai-gateway",
      model: "openai/gpt-5.1",
    }),
    "open-responses-compatible",
  );
  assert.equal(
    resolveOpenResponsesSdkProvider({
      llmVendor: "vercel-ai-gateway",
      model: "openai/gpt-5.1",
      responsesProvider: "open-responses-compatible",
    }),
    "open-responses-compatible",
  );
});

test("resolveOpenResponsesSdkProvider honors explicit openai provider override", () => {
  assert.equal(
    resolveOpenResponsesSdkProvider({
      llmVendor: "vercel-ai-gateway",
      model: "openai/gpt-5.1",
      responsesProvider: "openai",
    }),
    "openai",
  );
  assert.equal(
    resolveOpenResponsesSdkProvider({
      llmVendor: "fireworks-ai",
      model: "accounts/fireworks/models/deepseek-v3p1",
      responsesProvider: "openai",
    }),
    "openai",
  );
});

test("resolveOpenResponsesSdkProvider gateway non-openai route stays compatible", () => {
  assert.equal(
    resolveOpenResponsesSdkProvider({
      llmVendor: "vercel-ai-gateway",
      model: "anthropic/claude-sonnet-4",
    }),
    "open-responses-compatible",
  );
});

test("resolveOpenResponsesLanguageModelId strips gateway openai prefix", () => {
  assert.equal(
    resolveOpenResponsesLanguageModelId({
      llmVendor: "vercel-ai-gateway",
      model: "openai/gpt-5.4-mini",
    }),
    "gpt-5.4-mini",
  );
  assert.equal(
    resolveOpenResponsesLanguageModelId({
      llmVendor: "openrouter",
      model: "openai/gpt-5.4-mini",
    }),
    "gpt-5.4-mini",
  );
  assert.equal(
    resolveOpenResponsesLanguageModelId({
      llmVendor: "openai",
      model: "gpt-5.1",
    }),
    "gpt-5.1",
  );
});

test("resolveOpenResponsesSdkProvider openrouter stays open-responses-compatible", () => {
  assert.equal(
    resolveOpenResponsesSdkProvider({
      llmVendor: "openrouter",
      model: "openai/gpt-5.1",
    }),
    "open-responses-compatible",
  );
});

test("resolveOpenResponsesSdkProvider azure uses official azure sdk", () => {
  assert.equal(
    resolveOpenResponsesSdkProvider({
      llmVendor: "azure",
      model: "my-gpt4o-deploy",
    }),
    "azure",
  );
  assert.equal(
    resolveOpenResponsesSdkProvider({
      llmVendor: "azure",
      model: "my-gpt4o-deploy",
      responsesProvider: "azure",
    }),
    "azure",
  );
});

test("resolveAzureResourceName prefers explicit azureResourceName", () => {
  assert.equal(
    resolveAzureResourceName({
      azureResourceName: "my-resource",
      baseUrl: "https://other-resource.openai.azure.com/openai/v1",
    }),
    "my-resource",
  );
});

test("resolveAzureResourceName falls back to baseUrl host segment", () => {
  assert.equal(
    resolveAzureResourceName({
      baseUrl: "https://my-openai-resource.openai.azure.com/openai/v1",
    }),
    "my-openai-resource",
  );
});

test("resolveAzureResourceName throws when neither field is usable", () => {
  assert.throws(
    () => resolveAzureResourceName({ baseUrl: "https://api.openai.com/v1" }),
    /azureResourceName configuration is missing/,
  );
});

test("extractAzureResourceNameFromApiBase rejects invalid resource segments", () => {
  assert.equal(
    extractAzureResourceNameFromApiBase("https://bad name.openai.azure.com/openai/v1"),
    undefined,
  );
});

test("isGatewayOpenAiRoutedModel", () => {
  assert.equal(isGatewayOpenAiRoutedModel("openai/gpt-5.1"), true);
  assert.equal(isGatewayOpenAiRoutedModel("gpt-5.1"), false);
});

test("openResponsesReasoningTrace gpt-5.6 pro max includes mode and effort", () => {
  assert.deepEqual(
    openResponsesReasoningTrace({
      llmVendor: "vercel-ai-gateway",
      model: "openai/gpt-5.6-sol",
      reasoningEffort: "max",
      reasoningMode: "pro",
    }),
    { effort: "max", mode: "pro", summary: "auto" },
  );
});

test("openResponsesReasoningTrace gpt-5.6 standard omits mode", () => {
  assert.deepEqual(
    openResponsesReasoningTrace({
      llmVendor: "openai",
      model: "gpt-5.6-sol",
      reasoningEffort: "medium",
      reasoningMode: "standard",
    }),
    { effort: "medium", summary: "auto" },
  );
});

test("openResponsesReasoningTrace gpt-5.5 ignores mode and downgrades max", () => {
  assert.deepEqual(
    openResponsesReasoningTrace({
      llmVendor: "openai",
      model: "gpt-5.5",
      reasoningEffort: "max",
      reasoningMode: "pro",
    }),
    { effort: "xhigh", summary: "auto" },
  );
});

test("buildOpenResponsesRequestTrace uses deepseek_open_responses kind", () => {
  const trace = buildOpenResponsesRequestTrace(
    {
      transportKind: "open-responses",
      apiKey: "k",
      model: "deepseek-v4-flash",
      llmVendor: "deepseek",
    },
    1,
    [],
    [],
  );
  assert.equal((trace[0] as { kind?: string }).kind, "deepseek_open_responses");
});

test("resolveOpenResponsesReasoningSummary omits deepseek", () => {
  assert.equal(
    resolveOpenResponsesReasoningSummary({
      llmVendor: "deepseek",
      model: "deepseek-v4-flash",
      reasoningEffort: "high",
    }),
    undefined,
  );
});

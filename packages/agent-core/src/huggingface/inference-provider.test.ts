import assert from "node:assert/strict";
import test from "node:test";

import { resolveHuggingFaceInferenceProviderFromModelId } from "./inference-provider.js";

test("resolveHuggingFaceInferenceProviderFromModelId maps provider suffixes", () => {
  assert.equal(resolveHuggingFaceInferenceProviderFromModelId("moonshotai/Kimi-K3:groq"), "groq");
  assert.equal(resolveHuggingFaceInferenceProviderFromModelId("org/model:fastest"), undefined);
  assert.equal(resolveHuggingFaceInferenceProviderFromModelId("org/model:cheapest"), undefined);
  assert.equal(resolveHuggingFaceInferenceProviderFromModelId("org/model"), undefined);
});

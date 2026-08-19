import assert from "node:assert/strict";
import { test } from "vitest";

import {
  modelsDevProviderLogoId,
  modelsDevProviderLogoUrl,
  probeModelsDevReachability,
  resetModelsDevReachabilityProbeForTests,
} from "../../src/lib/models-dev-provider-logo.ts";

test("modelsDevProviderLogoId maps Spirit ids to models.dev provider folders", () => {
  assert.equal(modelsDevProviderLogoId("vercel-ai-gateway"), "vercel");
  assert.equal(modelsDevProviderLogoId("cloudflare-ai-gateway"), "cloudflare-ai-gateway");
  assert.equal(modelsDevProviderLogoId("moonshot-ai"), "moonshotai");
  assert.equal(modelsDevProviderLogoId("z-ai"), "zai");
  assert.equal(modelsDevProviderLogoId("zhipu-ai"), "zhipuai");
  assert.equal(modelsDevProviderLogoId("openai"), "openai");
  assert.equal(modelsDevProviderLogoId("google-vertex-ai"), "google-vertex");
  assert.equal(modelsDevProviderLogoId("fireworks-ai"), "fireworks-ai");
  assert.equal(modelsDevProviderLogoId("meituan"), "meituan");
  assert.equal(modelsDevProviderLogoId("mistral"), "mistral");
});

test("modelsDevProviderLogoUrl uses aliased provider id", () => {
  assert.equal(
    modelsDevProviderLogoUrl("vercel-ai-gateway"),
    "https://models.dev/logos/vercel.svg",
  );
  assert.equal(modelsDevProviderLogoUrl("z-ai"), "https://models.dev/logos/zai.svg");
  assert.equal(modelsDevProviderLogoUrl("zhipu-ai"), "https://models.dev/logos/zhipuai.svg");
  assert.equal(
    modelsDevProviderLogoUrl("fireworks-ai"),
    "https://models.dev/logos/fireworks-ai.svg",
  );
});

test("probeModelsDevReachability caches success and failure", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  try {
    resetModelsDevReachabilityProbeForTests();

    globalThis.fetch = async () => {
      fetchCalls += 1;
      return { ok: true };
    };

    assert.equal(await probeModelsDevReachability(), true);
    assert.equal(await probeModelsDevReachability(), true);
    assert.equal(fetchCalls, 1);

    resetModelsDevReachabilityProbeForTests();

    globalThis.fetch = async () => {
      fetchCalls += 1;
      throw new Error("network blocked");
    };

    assert.equal(await probeModelsDevReachability(), false);
    assert.equal(await probeModelsDevReachability(), false);
    assert.equal(fetchCalls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    resetModelsDevReachabilityProbeForTests();
  }
});

test("probeModelsDevReachability treats non-ok response as unreachable", async () => {
  const originalFetch = globalThis.fetch;

  try {
    resetModelsDevReachabilityProbeForTests();
    globalThis.fetch = async () => ({ ok: false });
    assert.equal(await probeModelsDevReachability(), false);
  } finally {
    globalThis.fetch = originalFetch;
    resetModelsDevReachabilityProbeForTests();
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadModelProfile } from "./credentials/index.js";
import { resolveProfileApiBase } from "./provider-setup.js";

test("resolveProfileApiBase routes z-ai glm-coding-plan profiles to the coding endpoint", () => {
  assert.equal(
    resolveProfileApiBase({ provider: "z-ai", zAiBillingMode: "glm-coding-plan" }),
    "https://api.z.ai/api/coding/paas/v4",
  );
  assert.equal(resolveProfileApiBase({ provider: "z-ai" }), "https://api.z.ai/api/paas/v4");
});

test("resolveProfileApiBase routes zhipu-ai glm-coding-plan profiles to the coding endpoint", () => {
  assert.equal(
    resolveProfileApiBase({ provider: "zhipu-ai", zhipuBillingMode: "glm-coding-plan" }),
    "https://open.bigmodel.cn/api/coding/paas/v4",
  );
});

test("resolveProfileApiBase routes alibaba token-plan and stepfun step-plan profiles", () => {
  const alibaba = resolveProfileApiBase({
    provider: "alibaba",
    alibabaBillingMode: "token-plan",
  });
  assert.notEqual(alibaba, resolveProfileApiBase({ provider: "alibaba" }));
  const stepfun = resolveProfileApiBase({
    provider: "stepfun",
    stepfunBillingMode: "step-plan",
  });
  assert.notEqual(stepfun, resolveProfileApiBase({ provider: "stepfun" }));
});

test("loadModelProfile carries group billing modes into the runtime profile", () => {
  const spiritDataDir = mkdtempSync(join(tmpdir(), "spirit-provider-setup-test-"));
  writeFileSync(
    join(spiritDataDir, "config.json"),
    `${JSON.stringify(
      {
        schemaVersion: 2,
        providerGroups: [
          {
            id: "group-zai",
            provider: "z-ai",
            apiBase: "https://api.z.ai/api/coding/paas/v4",
            zAiBillingMode: "glm-coding-plan",
            models: [{ name: "glm-5.2", reasoningEffort: "medium" }],
          },
        ],
        activeModel: { groupId: "group-zai", name: "glm-5.2" },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  const profile = loadModelProfile(spiritDataDir, { groupId: "group-zai", name: "glm-5.2" });
  assert.ok(profile);
  assert.equal(profile.zAiBillingMode, "glm-coding-plan");
  assert.equal(resolveProfileApiBase(profile), "https://api.z.ai/api/coding/paas/v4");
});

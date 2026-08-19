import assert from "node:assert/strict";
import { test } from "vitest";

import { defaultArkApiBase, isArkApiBase, isArkLlmVendor } from "./ark-provider.js";

test("isArkLlmVendor matches volcengine and byteplus only", () => {
  assert.equal(isArkLlmVendor("volcengine"), true);
  assert.equal(isArkLlmVendor("byteplus"), true);
  assert.equal(isArkLlmVendor("deepseek"), false);
  assert.equal(isArkLlmVendor(undefined), false);
});

test("isArkApiBase matches volces and bytepluses hostnames", () => {
  assert.equal(isArkApiBase("https://ark.cn-beijing.volces.com/api/v3"), true);
  assert.equal(isArkApiBase("https://ark.ap-southeast.bytepluses.com/api/v3"), true);
  assert.equal(isArkApiBase("https://api.openai.com/v1"), false);
  assert.equal(isArkApiBase(undefined), false);
});

test("defaultArkApiBase picks region by llmVendor", () => {
  assert.equal(defaultArkApiBase("volcengine"), "https://ark.cn-beijing.volces.com/api/v3");
  assert.equal(defaultArkApiBase("byteplus"), "https://ark.ap-southeast.bytepluses.com/api/v3");
  assert.equal(defaultArkApiBase(undefined), "https://ark.cn-beijing.volces.com/api/v3");
});

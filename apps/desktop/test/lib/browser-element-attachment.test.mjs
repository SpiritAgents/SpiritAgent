import assert from "node:assert/strict";
import test from "node:test";

import { truncateOuterHtml } from "../../src/lib/browser-element-attachment.ts";

test("truncateOuterHtml keeps short html unchanged", () => {
  const html = "<div>ok</div>";
  assert.equal(truncateOuterHtml(html), html);
});

test("truncateOuterHtml truncates by code points without splitting surrogate pairs", () => {
  // 前缀 4095 个 code unit，第 4096/4097 个 unit 是一个代理对
  const html = `<div>${"a".repeat(4090)}🎉🎉🎉</div>`;
  const truncated = truncateOuterHtml(html);
  assert.equal(truncated.endsWith("…"), true);
  assert.equal(truncated.isWellFormed(), true);
  assert.equal([...truncated].length, 4096 + 1);
});

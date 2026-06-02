import assert from "node:assert/strict";
import { test } from "node:test";

import { buildSkillSlashSuggestions } from "../src/lib/skill-slash.ts";

test("buildSkillSlashSuggestions includes loop command", () => {
  const suggestions = buildSkillSlashSuggestions("/loop", []);
  assert.ok(suggestions.some((item) => item.kind === "loop" && item.alias === "/loop"));
});

test("buildSkillSlashSuggestions filters loop by prefix", () => {
  const suggestions = buildSkillSlashSuggestions("/lo", []);
  assert.ok(suggestions.some((item) => item.kind === "loop"));
  assert.equal(buildSkillSlashSuggestions("/compact", []).some((item) => item.kind === "loop"), false);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  HOST_UI_PROMPT_SECTION_MAX_CHARS,
  joinHostPromptSections,
  normalizeHostUiPromptSection,
} from "../src/host-ui-prompt.js";

test("normalizeHostUiPromptSection trims and rejects empty", () => {
  assert.equal(normalizeHostUiPromptSection("  hello  "), "hello");
  assert.equal(normalizeHostUiPromptSection("   "), undefined);
  assert.equal(normalizeHostUiPromptSection(1), undefined);
});

test("normalizeHostUiPromptSection rejects oversized payload", () => {
  assert.equal(
    normalizeHostUiPromptSection("x".repeat(HOST_UI_PROMPT_SECTION_MAX_CHARS + 1)),
    undefined,
  );
  assert.equal(
    normalizeHostUiPromptSection("x".repeat(HOST_UI_PROMPT_SECTION_MAX_CHARS)),
    "x".repeat(HOST_UI_PROMPT_SECTION_MAX_CHARS),
  );
});

test("joinHostPromptSections skips blanks and joins with blank line", () => {
  assert.equal(joinHostPromptSections(undefined, "  ", undefined), undefined);
  assert.equal(joinHostPromptSections("a", undefined, "b"), "a\n\nb");
});

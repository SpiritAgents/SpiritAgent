import assert from "node:assert/strict";
import test from "node:test";

import { buildToolAgentHostPrompt } from "./tool-agent.js";

test("buildToolAgentHostPrompt points product questions at the official site", () => {
  const prompt = buildToolAgentHostPrompt("test-model", "test-provider");
  assert.match(prompt, /official site is https:\/\/spirit\.fast/);
  assert.match(prompt, /https:\/\/spirit\.fast\/llms\.txt/);
  assert.match(prompt, /https:\/\/spirit\.fast\/docs/);
  assert.match(prompt, /instead of answering from memory/);
});

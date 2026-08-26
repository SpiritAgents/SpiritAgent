import assert from "node:assert/strict";
import { test } from "vitest";

import { createLlmMessageContentFromTextAndImages } from "@spiritagent/agent-core";

import {
  isFirstUserTurnInHistory,
  mediaPathsFromLatestUserMessage,
  shouldScheduleSessionTitleGeneration,
} from "../src/session-title-generation.js";

test("isFirstUserTurnInHistory is true only for a single user message", () => {
  assert.equal(isFirstUserTurnInHistory([]), false);
  assert.equal(
    isFirstUserTurnInHistory([
      { role: "user", content: createLlmMessageContentFromTextAndImages("hi") },
    ]),
    true,
  );
  assert.equal(
    isFirstUserTurnInHistory([
      { role: "user", content: createLlmMessageContentFromTextAndImages("one") },
      { role: "assistant", content: createLlmMessageContentFromTextAndImages("ok") },
      { role: "user", content: createLlmMessageContentFromTextAndImages("two") },
    ]),
    false,
  );
});

test("mediaPathsFromLatestUserMessage reads image and video parts", () => {
  const media = mediaPathsFromLatestUserMessage([
    {
      role: "user",
      content: createLlmMessageContentFromTextAndImages("see", ["shot.png"], ["clip.mp4"]),
    },
  ]);
  assert.deepEqual(media.imagePaths, ["shot.png"]);
  assert.deepEqual(media.videoPaths, ["clip.mp4"]);
});

test("shouldScheduleSessionTitleGeneration skips dream-collector and ephemeral sessions", () => {
  const history = [
    { role: "user" as const, content: createLlmMessageContentFromTextAndImages("hi") },
  ];
  assert.equal(shouldScheduleSessionTitleGeneration({ history }), true);
  assert.equal(
    shouldScheduleSessionTitleGeneration({ history, sessionKind: "dream-collector" }),
    false,
  );
  assert.equal(
    shouldScheduleSessionTitleGeneration({
      history,
      conversationKey: "ephemeral://session-title/demo",
    }),
    false,
  );
});

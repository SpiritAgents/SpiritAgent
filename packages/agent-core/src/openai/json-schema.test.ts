import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "vitest";

import { buildJsonSchemaCompletionMessages } from "./json-schema.js";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: { title: { type: "string" } },
  required: ["title"],
};

test("buildJsonSchemaCompletionMessages keeps a string user message without media", () => {
  const messages = buildJsonSchemaCompletionMessages(
    { model: "test-model" },
    {
      userPrompt: "Name this conversation",
      schemaName: "session_title",
      schema,
      includeToolAgentHostPrompt: false,
    },
  );

  assert.equal(messages.at(1)?.role, "user");
  assert.equal(messages.at(1)?.content, "Name this conversation");
});

test("buildJsonSchemaCompletionMessages attaches image_url and video_url parts", () => {
  const workspaceRoot = "/workspace";
  const messages = buildJsonSchemaCompletionMessages(
    { model: "test-model", workspaceRoot },
    {
      userPrompt: "Name this conversation",
      schemaName: "session_title",
      schema,
      includeToolAgentHostPrompt: false,
      imagePaths: ["shot.png"],
      videoPaths: ["clip.mp4"],
    },
  );

  const user = messages.at(1) as {
    role: string;
    content: Array<Record<string, unknown>>;
  };
  assert.equal(user.role, "user");
  assert.equal(user.content[0]?.type, "text");
  assert.equal(user.content[0]?.text, "Name this conversation");
  assert.equal(user.content[1]?.type, "image_url");
  assert.equal(user.content[2]?.type, "video_url");
  const videoUrl = (user.content[2]?.video_url as { url: string } | undefined)?.url;
  assert.equal(videoUrl, resolve(workspaceRoot, "clip.mp4").replace(/\\/g, "/"));
});

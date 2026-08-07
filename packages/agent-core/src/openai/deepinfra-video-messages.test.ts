import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { createLlmVideoContentPart } from "../ports.js";
import { llmMessageToOpenAiMessage } from "./openai-multimodal-messages.js";
import { resolveDeepInfraVideoUrlsInOpenAiMessages } from "./deepinfra-video-messages.js";

const MINIMAL_MP4_HEADER = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
]);

function deepInfraConfig(capabilities?: { videoInput?: true }) {
  return {
    apiKey: "test-key",
    baseUrl: "https://api.deepinfra.com/v1/openai",
    model: "acme/video-chat",
    llmVendor: "deepinfra" as const,
    ...(capabilities ? { modelCapabilities: capabilities } : {}),
  };
}

test("resolveDeepInfraVideoUrlsInOpenAiMessages embeds local video as data URL base64", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "spirit-agent-core-deepinfra-video-"));
  const videoPath = join(workspaceRoot, "clip.mp4");
  try {
    await writeFile(videoPath, MINIMAL_MP4_HEADER);

    const messages = [
      llmMessageToOpenAiMessage(
        {
          role: "user",
          content: [createLlmVideoContentPart(videoPath)],
        },
        workspaceRoot,
      ),
    ];

    resolveDeepInfraVideoUrlsInOpenAiMessages(
      deepInfraConfig({ videoInput: true }),
      messages,
      workspaceRoot,
    );

    const url =
      (messages[0] as { content: Array<{ video_url: { url: string } }> }).content[0]?.video_url
        .url ?? "";
    assert.match(url, /^data:video\/mp4;base64,/);
    assert.equal(url.slice("data:video/mp4;base64,".length), MINIMAL_MP4_HEADER.toString("base64"));
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("resolveDeepInfraVideoUrlsInOpenAiMessages guesses mime from extension", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "spirit-agent-core-deepinfra-video-"));
  try {
    for (const [fileName, mime] of [
      ["clip.mov", "video/quicktime"],
      ["clip.webm", "video/webm"],
      ["clip.avi", "video/x-msvideo"],
      ["clip.unknownext", "video/mp4"],
    ] as const) {
      const videoPath = join(workspaceRoot, fileName);
      await writeFile(videoPath, MINIMAL_MP4_HEADER);

      const messages = [
        llmMessageToOpenAiMessage(
          {
            role: "user",
            content: [createLlmVideoContentPart(videoPath)],
          },
          workspaceRoot,
        ),
      ];

      resolveDeepInfraVideoUrlsInOpenAiMessages(
        deepInfraConfig({ videoInput: true }),
        messages,
        workspaceRoot,
      );

      const url =
        (messages[0] as { content: Array<{ video_url: { url: string } }> }).content[0]?.video_url
          .url ?? "";
      assert.match(url, new RegExp(`^data:${mime.replace("/", "\\/")};base64,`));
    }
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("resolveDeepInfraVideoUrlsInOpenAiMessages leaves public https and data URLs unchanged", () => {
  const messages = [
    {
      role: "user",
      content: [
        { type: "video_url", video_url: { url: "https://example.com/video.mp4" } },
        { type: "video_url", video_url: { url: "data:video/mp4;base64,AAAA" } },
        { type: "video_url", video_url: { url: "ms://file-abc" } },
      ],
    },
  ];

  resolveDeepInfraVideoUrlsInOpenAiMessages(deepInfraConfig({ videoInput: true }), messages);

  const content = (messages[0] as { content: Array<{ video_url: { url: string } }> }).content;
  assert.equal(content[0]?.video_url.url, "https://example.com/video.mp4");
  assert.equal(content[1]?.video_url.url, "data:video/mp4;base64,AAAA");
  assert.equal(content[2]?.video_url.url, "ms://file-abc");
});

test("resolveDeepInfraVideoUrlsInOpenAiMessages skips other vendors", () => {
  const messages = [
    {
      role: "user",
      content: [{ type: "video_url", video_url: { url: "/tmp/local-clip.mp4" } }],
    },
  ];

  resolveDeepInfraVideoUrlsInOpenAiMessages(
    { ...deepInfraConfig({ videoInput: true }), llmVendor: "xiaomi" },
    messages,
  );

  const url = (messages[0] as { content: Array<{ video_url: { url: string } }> }).content[0]
    ?.video_url.url;
  assert.equal(url, "/tmp/local-clip.mp4");
});

test("resolveDeepInfraVideoUrlsInOpenAiMessages skips when video input capability is off", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "spirit-agent-core-deepinfra-video-"));
  const videoPath = join(workspaceRoot, "clip.mp4");
  try {
    await writeFile(videoPath, MINIMAL_MP4_HEADER);

    const messages = [
      llmMessageToOpenAiMessage(
        {
          role: "user",
          content: [createLlmVideoContentPart(videoPath)],
        },
        workspaceRoot,
      ),
    ];
    const before = JSON.stringify(messages);

    resolveDeepInfraVideoUrlsInOpenAiMessages(deepInfraConfig({}), messages, workspaceRoot);

    assert.equal(JSON.stringify(messages), before);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

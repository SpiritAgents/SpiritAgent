import assert from "node:assert/strict";
import { test } from "vitest";

import { setLlmFetchTransportOverrideForTests } from "../llm-fetch.js";
import type { LlmStreamEvent } from "../ports.js";
import { AiSdkOpenAiCompatibleTransport } from "./ai-sdk-transport.js";

function sseResponse(chunks: Record<string, unknown>[]): Response {
  const lines = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("");
  return new Response(`${lines}data: [DONE]\n\n`, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

const STREAM_CHUNKS: Record<string, unknown>[] = [
  {
    id: "chatcmpl-kimi-code",
    object: "chat.completion.chunk",
    created: 0,
    model: "k3",
    choices: [{ index: 0, delta: { role: "assistant", content: "ok" }, finish_reason: null }],
  },
  {
    id: "chatcmpl-kimi-code",
    object: "chat.completion.chunk",
    created: 0,
    model: "k3",
    choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
  },
];

async function runStreamingRound(
  llmVendor: "kimi-code" | "custom",
  capturedBodies: Record<string, unknown>[],
) {
  setLlmFetchTransportOverrideForTests(async (_input, init) => {
    capturedBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return sseResponse(STREAM_CHUNKS);
  });

  const transport = new AiSdkOpenAiCompatibleTransport();
  try {
    const started = await transport.startToolAgentRoundStreaming(
      {
        apiKey: "test-key",
        model: "k3",
        baseUrl: "https://api.kimi.com/coding/v1",
        llmVendor,
        workspaceRoot: process.cwd(),
      },
      { messages: [{ role: "user", content: "hi" }], steps: 0 },
      [],
    );
    for await (const event of started.eventStream as AsyncIterable<LlmStreamEvent>) {
      assert.notEqual(event.kind, "error");
    }
    return await started.completion;
  } finally {
    setLlmFetchTransportOverrideForTests(undefined);
  }
}

test("Kimi Code streaming chat completions request includes stream_options.include_usage", async () => {
  const capturedBodies: Record<string, unknown>[] = [];
  const completion = await runStreamingRound("kimi-code", capturedBodies);

  const chatCompletionBody = capturedBodies.at(-1);
  assert.ok(chatCompletionBody);
  assert.equal(chatCompletionBody.stream, true);
  assert.deepEqual(chatCompletionBody.stream_options, { include_usage: true });

  assert.equal(completion.kind, "success");
  if (completion.kind !== "success") {
    return;
  }
  assert.equal(completion.result.usage?.inputTokens, 10);
  assert.equal(completion.result.usage?.totalTokens, 12);
});

test("other openai-compatible vendors still omit stream_options.include_usage", async () => {
  const capturedBodies: Record<string, unknown>[] = [];
  const completion = await runStreamingRound("custom", capturedBodies);

  const chatCompletionBody = capturedBodies.at(-1);
  assert.ok(chatCompletionBody);
  assert.equal(chatCompletionBody.stream, true);
  assert.equal(chatCompletionBody.stream_options, undefined);

  assert.equal(completion.kind, "success");
});

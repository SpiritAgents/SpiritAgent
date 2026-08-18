import { setTimeout as waitForDelay } from "node:timers/promises";

import { AiSdkOpenAiCompatibleTransport } from "../../openai/ai-sdk-transport.js";
import {
  appendOpenAiToolResultMessage,
  extractLastOpenAiAssistantText,
  startOpenAiToolAgentState,
} from "../../openai/tool-agent-helpers.js";
import type { LlmMessage } from "../../ports.js";
import { createLlmMessageContentFromText } from "../../ports.js";
import { AgentRuntime, type RuntimeEvent } from "../../runtime.js";

import { DemoToolExecutor, type DemoToolRequest } from "./demo-tool.js";

export function createAiSdkOpenAiSmokeTransport(): AiSdkOpenAiCompatibleTransport {
  return new AiSdkOpenAiCompatibleTransport();
}

export function createAiSdkOpenAiDemoRuntime(options: {
  config: {
    apiKey: string;
    model: string;
    baseUrl?: string;
  };
  onEvent?: (event: RuntimeEvent<DemoToolRequest>) => void;
}) {
  const smokeConfig = options.config;
  return new AgentRuntime({
    config: smokeConfig,
    llmTransport: createAiSdkOpenAiSmokeTransport(),
    toolExecutor: new DemoToolExecutor(),
    createToolAgentState: (messages, userInput) =>
      startOpenAiToolAgentState(messages, userInput, process.cwd(), [], [], smokeConfig.model),
    appendToolResultMessage: appendOpenAiToolResultMessage,
    extractAssistantText: extractLastOpenAiAssistantText,
    ...(options.onEvent ? { onEvent: options.onEvent } : {}),
  });
}

export async function pollRuntimeUntilIdle<Config, State, ToolRequest, TrustTarget = string>(
  runtime: AgentRuntime<Config, State, ToolRequest, TrustTarget>,
  timeoutMs = 60_000,
  pollIntervalMs = 50,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (runtime.isBusy() && Date.now() < deadline) {
    await waitForDelay(pollIntervalMs);
    await runtime.poll();
  }

  return !runtime.isBusy();
}

export function buildCompactSmokeHistory(): LlmMessage[] {
  return [
    {
      role: "assistant",
      content: createLlmMessageContentFromText("Let me list packages/agent-core first."),
      toolCalls: [
        {
          id: "call-list-agent-core",
          name: "list_dir",
          argumentsJson: '{"path":"packages/agent-core"}',
        },
      ],
    },
    {
      role: "tool",
      toolCallId: "call-list-agent-core",
      content: createLlmMessageContentFromText("package.json\nsrc/openai/ai-sdk-transport.ts"),
    },
    {
      role: "user",
      content: createLlmMessageContentFromText(
        "Migrate this Rust agent to TypeScript, but don't touch the UI yet.",
      ),
    },
    {
      role: "assistant",
      content: createLlmMessageContentFromText(
        "OK, migrate the low-level provider and tool runtime first; the Rust TUI acts as host for now.",
      ),
    },
    {
      role: "user",
      content: createLlmMessageContentFromText(
        "First step: integrate the OpenAI SDK and add a real smoke.",
      ),
    },
    {
      role: "assistant",
      content: createLlmMessageContentFromText(
        "OpenAI SDK integrated; basic chat and tool call smokes pass; next add round-trip and compact smokes.",
      ),
    },
    {
      role: "assistant",
      content: createLlmMessageContentFromText(
        "Let me re-read the openai transport implementation.",
      ),
      toolCalls: [
        {
          id: "call-read-openai-transport",
          name: "read_file",
          argumentsJson: '{"filePath":"packages/agent-core/src/openai/ai-sdk-transport.ts"}',
        },
      ],
    },
    {
      role: "tool",
      toolCallId: "call-read-openai-transport",
      content: createLlmMessageContentFromText(
        "contains AiSdkOpenAiCompatibleTransport and compactHistoryManual",
      ),
    },
    {
      role: "user",
      content: createLlmMessageContentFromText(
        "When compacting, keep the migration goal, the SDK integration status, and the remaining host bridge work.",
      ),
    },
    {
      role: "assistant",
      content: createLlmMessageContentFromText(
        "Got it; the summary will keep the goal, the verified pipeline, and the pending host/core bridge.",
      ),
    },
  ];
}

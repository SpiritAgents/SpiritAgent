import {
  AgentRuntime,
  FinalTextTransport,
  HostExecutor,
  StreamingFinalTransport,
  appendScriptedToolResult,
  appendScriptedUserMessage,
  createScriptedState,
  extractScriptedAssistantText,
  flushMicrotasks,
  isJsonObject,
  llmMessageTextContent,
  type RuntimeParityCaseResult,
  userMessageContentMatchesInput,
} from "./harness.js";
import { formatMcpResourceFetchResultJson } from "../../../../tool-gateway/fetch-mcp-resource.js";

export async function runMcpCase(): Promise<RuntimeParityCaseResult> {
  const promptRuntime = new AgentRuntime({
    config: undefined,
    llmTransport: new FinalTextTransport("PROMPT_OK", (state) => {
      if (
        !state.messages.some(
          (message) => isJsonObject(message) && message.content === "prompt-system:analysis",
        )
      ) {
        throw new Error("prompt system message was not injected into state.");
      }
      if (
        !state.messages.some(
          (message) => isJsonObject(message) && message.content === "prompt-user-message",
        )
      ) {
        throw new Error("prompt user message was not injected into state.");
      }
      if (
        !state.messages.some(
          (message) =>
            isJsonObject(message) &&
            typeof message.content === "string" &&
            userMessageContentMatchesInput(message.content, "additional notes"),
        )
      ) {
        throw new Error("prompt extra user message was not injected into state.");
      }
    }),
    toolExecutor: new HostExecutor(),
    createToolAgentState: createScriptedState,
    appendToolResultMessage: appendScriptedToolResult,
    appendUserMessage: appendScriptedUserMessage,
    extractAssistantText: extractScriptedAssistantText,
  });

  const promptApplied = await promptRuntime.applyMcpPrompt(
    "demo",
    "analysis",
    undefined,
    "additional notes",
  );
  if (
    promptApplied.result.kind !== "completed" ||
    promptApplied.result.assistantText !== "PROMPT_OK"
  ) {
    throw new Error("applyMcpPrompt smoke did not complete the turn loop.");
  }
  if (!promptApplied.notice.includes("Applied MCP prompt: demo / analysis")) {
    throw new Error("applyMcpPrompt smoke notice is incorrect.");
  }

  const streamingPromptRuntime = new AgentRuntime({
    config: undefined,
    llmTransport: new StreamingFinalTransport(),
    toolExecutor: new HostExecutor(),
    createToolAgentState: createScriptedState,
    appendToolResultMessage: appendScriptedToolResult,
    appendUserMessage: appendScriptedUserMessage,
    extractAssistantText: extractScriptedAssistantText,
  });

  const startedPrompt = await streamingPromptRuntime.startApplyMcpPrompt(
    "demo",
    "analysis",
    undefined,
    "Help me check what this tool does",
  );
  if (!startedPrompt.includes("Applied MCP prompt: demo / analysis")) {
    throw new Error("startApplyMcpPrompt smoke notice is incorrect.");
  }
  for (let index = 0; index < 24 && streamingPromptRuntime.isBusy(); index += 1) {
    await flushMicrotasks(8);
    await streamingPromptRuntime.poll();
  }
  if (streamingPromptRuntime.isBusy()) {
    throw new Error("streaming prompt smoke did not finish within the expected rounds.");
  }
  const drainedStreamingPromptEvents = streamingPromptRuntime.drainEvents();
  if (
    drainedStreamingPromptEvents.filter((event) => event.kind === "begin-assistant-response")
      .length !== 1
  ) {
    throw new Error("streaming prompt smoke begin event count is incorrect.");
  }
  if (drainedStreamingPromptEvents.filter((event) => event.kind === "assistant-chunk").length < 2) {
    throw new Error("streaming prompt smoke is missing assistant chunk events.");
  }
  if (
    !drainedStreamingPromptEvents.some((event) => event.kind === "assistant-response-completed")
  ) {
    throw new Error("streaming prompt smoke is missing the completed event.");
  }
  if (
    !streamingPromptRuntime
      .history()
      .some(
        (message) =>
          message.role === "user" &&
          userMessageContentMatchesInput(
            llmMessageTextContent(message.content),
            "Help me check what this tool does",
          ),
      )
  ) {
    throw new Error("streaming prompt smoke did not preserve the extra user message.");
  }

  const resourceRuntime = new AgentRuntime({
    config: undefined,
    llmTransport: new FinalTextTransport("RESOURCE_OK", (state) => {
      if (
        !state.messages.some(
          (message) =>
            isJsonObject(message) &&
            typeof message.content === "string" &&
            message.content.startsWith("[MCP_RESOURCE]"),
        )
      ) {
        throw new Error("MCP resource context was not injected into state.");
      }
    }),
    toolExecutor: new HostExecutor(),
    createToolAgentState: createScriptedState,
    appendToolResultMessage: appendScriptedToolResult,
    appendUserMessage: appendScriptedUserMessage,
    extractAssistantText: extractScriptedAssistantText,
  });

  const resourceLabel = await resourceRuntime.attachMcpResource("demo", "mcp://demo/doc");
  if (resourceLabel !== "demo -> mcp://demo/doc") {
    throw new Error("attachMcpResource smoke label is incorrect.");
  }
  const resourceResult = await resourceRuntime.submitUserTurn("Answer using the resource");
  if (resourceResult.kind !== "completed" || resourceResult.assistantText !== "RESOURCE_OK") {
    throw new Error("attachMcpResource smoke did not complete the turn loop.");
  }
  if (resourceRuntime.pendingMcpResources().length !== 0) {
    throw new Error("attachMcpResource smoke should clear pending resources after submission.");
  }

  const hostExecutor = new HostExecutor();
  const resourceValue = await hostExecutor.readMcpResource("demo", "mcp://demo/doc");
  const resourceJson = formatMcpResourceFetchResultJson(resourceValue);
  const parsed = JSON.parse(resourceJson) as { text?: string };
  if (parsed.text !== "resource body") {
    throw new Error("fetch_mcp_resource JSON formatting smoke is incorrect.");
  }

  const archive = resourceRuntime.toArchive([{ role: "user", content: "u" }], []);
  const restoredRuntime = new AgentRuntime({
    config: undefined,
    llmTransport: new FinalTextTransport("RESTORED_OK"),
    toolExecutor: new HostExecutor(),
    createToolAgentState: createScriptedState,
    appendToolResultMessage: appendScriptedToolResult,
    appendUserMessage: appendScriptedUserMessage,
    extractAssistantText: extractScriptedAssistantText,
  });
  restoredRuntime.replaceFromArchive(archive);
  if (restoredRuntime.history().length !== archive.llmHistory.length) {
    throw new Error("replaceFromArchive smoke did not restore llmHistory.");
  }

  return { promptApplied, drainedStreamingPromptEvents, resourceResult, resourceJson, archive };
}

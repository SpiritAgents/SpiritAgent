import {
  AgentRuntime,
  SubagentExecutor,
  SubagentTransport,
  appendScriptedToolResult,
  appendScriptedUserMessage,
  createScriptedState,
  extractScriptedAssistantText,
  type RuntimeParityCaseResult,
  type ScriptedToolRequest,
} from "./harness.js";
import type { RuntimeEvent } from "../../../../runtime.js";

export async function runSubagentCase(): Promise<RuntimeParityCaseResult> {
  const subagentExecutor = new SubagentExecutor();
  const parentEvents: RuntimeEvent<ScriptedToolRequest>[] = [];
  const subagentRuntime = new AgentRuntime({
    config: undefined,
    llmTransport: new SubagentTransport(),
    toolExecutor: subagentExecutor,
    createToolAgentState: createScriptedState,
    appendToolResultMessage: appendScriptedToolResult,
    appendUserMessage: appendScriptedUserMessage,
    extractAssistantText: extractScriptedAssistantText,
    onEvent: (event) => parentEvents.push(event),
  });

  const subagentResult = await subagentRuntime.submitUserTurn("Call the SubAgent to output a sentence");
  if (subagentResult.kind !== "completed" || subagentResult.assistantText !== "SUBAGENT_OK") {
    throw new Error("subagent smoke did not complete the turn loop.");
  }
  if (subagentExecutor.executedSubagentCalls !== 0) {
    throw new Error("subagent smoke incorrectly fell through to host execute.");
  }
  const subagentExecution = subagentResult.toolExecutions.find(
    (execution) => execution.toolName === "subagent",
  );
  if (
    !subagentExecution ||
    subagentExecution.failed ||
    subagentExecution.output !== "OK, I am the SubAgent, hahaha"
  ) {
    throw new Error("subagent smoke did not record the correct subagent tool result.");
  }

  // Child session events may only reach the host via drainActiveChildSessionEvents; they must
  // not leak through the parent session onEvent (otherwise the server broadcasts child
  // thinking/content as the main session's runtime.event and leaked cards appear on the desktop main page).
  const leakedChildEvent = parentEvents.find(
    (event) =>
      (event.kind === "assistant-chunk" ||
        event.kind === "replace-pending-assistant" ||
        event.kind === "update-pending-assistant-thinking" ||
        event.kind === "assistant-thinking-segment-finalized") &&
      event.text.includes("OK, I am the SubAgent"),
  );
  if (leakedChildEvent) {
    throw new Error("subagent smoke child session events leaked through the parent session onEvent.");
  }

  return { subagentResult };
}

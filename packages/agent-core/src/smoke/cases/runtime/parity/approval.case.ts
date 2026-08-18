import {
  AgentRuntime,
  ApprovalExecutor,
  ApprovalTransport,
  appendScriptedToolResult,
  appendScriptedUserMessage,
  createScriptedState,
  extractScriptedAssistantText,
  type RuntimeParityCaseResult,
} from "./harness.js";

export async function runApprovalCase(): Promise<RuntimeParityCaseResult> {
  const approvalExecutor = new ApprovalExecutor();
  const approvalRuntime = new AgentRuntime({
    config: undefined,
    llmTransport: new ApprovalTransport(),
    toolExecutor: approvalExecutor,
    createToolAgentState: createScriptedState,
    appendToolResultMessage: appendScriptedToolResult,
    appendUserMessage: appendScriptedUserMessage,
    extractAssistantText: extractScriptedAssistantText,
  });

  const approvalResult = await approvalRuntime.submitUserTurn("Please write the file directly.");
  if (approvalResult.kind !== "requires-approval") {
    throw new Error(`approval smoke expected requires-approval, got ${approvalResult.kind}`);
  }

  const approvalCompleted = await approvalRuntime.resumePendingApproval({
    kind: "guidance",
    userMessage: "Do not write the file, just summarize",
  });

  if (approvalCompleted.kind !== "completed" || approvalCompleted.assistantText !== "GUIDANCE_OK") {
    throw new Error("approval guidance smoke did not complete the turn loop.");
  }

  if (approvalExecutor.executedCalls !== 1) {
    throw new Error("approval guidance smoke should continue executing the queued tools.");
  }

  return { approvalCompleted };
}

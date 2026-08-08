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

  const subagentResult = await subagentRuntime.submitUserTurn("调用 SubAgent 输出一句话");
  if (subagentResult.kind !== "completed" || subagentResult.assistantText !== "SUBAGENT_OK") {
    throw new Error("subagent smoke 未完成闭环。");
  }
  if (subagentExecutor.executedSubagentCalls !== 0) {
    throw new Error("subagent smoke 错误落到了宿主 execute。");
  }
  const subagentExecution = subagentResult.toolExecutions.find(
    (execution) => execution.toolName === "subagent",
  );
  if (
    !subagentExecution ||
    subagentExecution.failed ||
    subagentExecution.output !== "好的，我是 SubAgent，哈哈哈"
  ) {
    throw new Error("subagent smoke 未记录正确的子代理工具结果。");
  }

  // 子会话事件只能经 drainActiveChildSessionEvents 抵达宿主，不得从父会话 onEvent 外溢
  // （否则 server 会把子思考/正文广播成主会话 runtime.event，桌面主页面出现泄漏卡片）。
  const leakedChildEvent = parentEvents.find(
    (event) =>
      (event.kind === "assistant-chunk" ||
        event.kind === "replace-pending-assistant" ||
        event.kind === "update-pending-assistant-thinking" ||
        event.kind === "assistant-thinking-segment-finalized") &&
      event.text.includes("好的，我是 SubAgent"),
  );
  if (leakedChildEvent) {
    throw new Error("subagent smoke 子会话事件经父会话 onEvent 外溢。");
  }

  return { subagentResult };
}

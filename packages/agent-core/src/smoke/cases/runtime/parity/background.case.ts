import {
  AgentRuntime,
  BackgroundExecutor,
  BackgroundTransport,
  PollingBackgroundExecutor,
  appendScriptedToolResult,
  appendScriptedUserMessage,
  createScriptedState,
  extractScriptedAssistantText,
  flushMicrotasks,
  type RuntimeEvent,
  type RuntimeParityCaseResult,
  type RuntimeTurnResult,
  type ScriptedState,
  type ScriptedToolRequest,
} from "./harness.js";

export async function runBackgroundCase(): Promise<RuntimeParityCaseResult> {
  const backgroundEvents: RuntimeEvent<ScriptedToolRequest>[] = [];
  const pollingBackgroundEvents: RuntimeEvent<ScriptedToolRequest>[] = [];

  const backgroundRuntime = new AgentRuntime({
    config: undefined,
    llmTransport: new BackgroundTransport(),
    toolExecutor: new BackgroundExecutor(),
    createToolAgentState: createScriptedState,
    appendToolResultMessage: appendScriptedToolResult,
    appendUserMessage: appendScriptedUserMessage,
    extractAssistantText: extractScriptedAssistantText,
    onEvent: (event) => backgroundEvents.push(event),
  });

  const backgroundResult = await backgroundRuntime.submitUserTurn("Please search for runtime parity in the background.");
  if (backgroundResult.kind !== "completed" || backgroundResult.assistantText !== "BACKGROUND_OK") {
    throw new Error("background execution smoke did not complete the turn loop.");
  }

  const startedBackground = backgroundEvents.find(
    (
      event,
    ): event is Extract<RuntimeEvent<ScriptedToolRequest>, { kind: "background-tool-status" }> =>
      event.kind === "background-tool-status" && event.phase === "started",
  );
  const finishedBackground = backgroundEvents.find(
    (
      event,
    ): event is Extract<RuntimeEvent<ScriptedToolRequest>, { kind: "background-tool-status" }> =>
      event.kind === "background-tool-status" && event.phase === "finished",
  );
  if (!startedBackground || !finishedBackground) {
    throw new Error("background execution smoke did not receive the started/finished events.");
  }
  if (startedBackground.statusText !== "Searching: runtime parity") {
    throw new Error("background execution smoke status text is incorrect.");
  }
  if (backgroundRuntime.backgroundToolStatus() !== undefined) {
    throw new Error("background execution smoke should clear the pending background status after finishing.");
  }

  const pollingBackgroundExecutor = new PollingBackgroundExecutor();
  const pollingBackgroundRuntime = new AgentRuntime({
    config: undefined,
    llmTransport: new BackgroundTransport(),
    toolExecutor: pollingBackgroundExecutor,
    createToolAgentState: createScriptedState,
    appendToolResultMessage: appendScriptedToolResult,
    appendUserMessage: appendScriptedUserMessage,
    extractAssistantText: extractScriptedAssistantText,
    onEvent: (event) => pollingBackgroundEvents.push(event),
  });

  await pollingBackgroundRuntime.startUserTurn("Please search for runtime parity in the background.");
  await flushMicrotasks(4);
  await pollingBackgroundRuntime.poll();
  if (!pollingBackgroundRuntime.isBusy()) {
    throw new Error("polling background smoke should stay busy while the background tool runs.");
  }
  if (pollingBackgroundRuntime.backgroundToolStatus() !== "Searching: runtime parity") {
    throw new Error("polling background smoke did not expose the background tool status.");
  }
  const backgroundAux = pollingBackgroundRuntime.pendingAuxState();
  if (
    !backgroundAux ||
    backgroundAux.kind !== "thinking" ||
    backgroundAux.detailText !== "Searching: runtime parity"
  ) {
    throw new Error("polling background smoke did not expose the thinking aux state.");
  }
  if (backgroundAux.statusText !== "") {
    throw new Error("polling background smoke should not put UI spinner copy into statusText.");
  }
  if (pollingBackgroundRuntime.takeCompletedTurnResult()) {
    throw new Error("polling background smoke should not produce a result before the background tool finishes.");
  }

  pollingBackgroundExecutor.finish('background result for {"query":"runtime parity"}');
  let pollingBackgroundResult:
    | RuntimeTurnResult<ScriptedState, ScriptedToolRequest, string>
    | undefined;
  for (let index = 0; index < 8; index += 1) {
    await flushMicrotasks(4);
    await pollingBackgroundRuntime.poll();
    pollingBackgroundResult = pollingBackgroundRuntime.takeCompletedTurnResult();
    if (pollingBackgroundResult) {
      break;
    }
  }
  if (
    !pollingBackgroundResult ||
    pollingBackgroundResult.kind !== "completed" ||
    pollingBackgroundResult.assistantText !== "BACKGROUND_OK"
  ) {
    throw new Error("polling background smoke did not get the final completion result.");
  }
  const pollingStartedBackground = pollingBackgroundEvents.find(
    (
      event,
    ): event is Extract<RuntimeEvent<ScriptedToolRequest>, { kind: "background-tool-status" }> =>
      event.kind === "background-tool-status" && event.phase === "started",
  );
  const pollingFinishedBackground = pollingBackgroundEvents.find(
    (
      event,
    ): event is Extract<RuntimeEvent<ScriptedToolRequest>, { kind: "background-tool-status" }> =>
      event.kind === "background-tool-status" && event.phase === "finished",
  );
  if (!pollingStartedBackground || !pollingFinishedBackground) {
    throw new Error("polling background smoke did not receive the complete background status events.");
  }
  const pollingToolFinished = pollingBackgroundEvents.find(
    (
      event,
    ): event is Extract<RuntimeEvent<ScriptedToolRequest>, { kind: "tool-execution-finished" }> =>
      event.kind === "tool-execution-finished",
  );
  if (!pollingToolFinished || pollingToolFinished.execution.toolName !== "grep") {
    throw new Error("polling background smoke should emit tool-execution-finished when the background tool completes.");
  }

  return { backgroundResult, pollingBackgroundResult };
}

import assert from "node:assert/strict";
import { test } from "vitest";

import {
  createToolExecutionTextOutput,
  type AuthorizationDecision,
  type JsonValue,
  type LlmMessage,
  type ToolExecutionOutput,
  type ToolExecutor,
} from "../ports.js";
import {
  pollPendingBackgroundToolExecution,
  scheduleBackgroundToolExecutionAsync,
  type BackgroundToolsRuntime,
} from "./background-tools.js";
import type { RuntimeEvent, RuntimeTurnContext } from "./types.js";

interface ShellToolRequest {
  name: "shell";
  command: string;
}

type TestState = { messages: string[] };

class DeferredShellExecutor implements ToolExecutor<ShellToolRequest> {
  readonly completions = new Map<string, () => void>();

  toolDefinitionsJson(): JsonValue {
    return [];
  }

  async parseCommand(): Promise<ShellToolRequest> {
    throw new Error("not implemented");
  }

  async requestFromFunctionCall(): Promise<ShellToolRequest> {
    throw new Error("not implemented");
  }

  async authorize(): Promise<AuthorizationDecision> {
    return { kind: "allowed" };
  }

  async rememberApproval(): Promise<void> {}

  async execute(request: ShellToolRequest): Promise<ToolExecutionOutput> {
    await new Promise<void>((resolve) => {
      this.completions.set(request.command, resolve);
    });
    return createToolExecutionTextOutput(`done:${request.command}`);
  }

  shouldExecuteInBackground(request: ShellToolRequest): boolean {
    return request.name === "shell";
  }

  startMcpBackgroundRefresh(): void {}

  mcpStatusSnapshot() {
    return {
      revision: 0,
      state: "idle" as const,
      configuredServers: 0,
      loadedServers: 0,
      cachedTools: 0,
    };
  }

  async addMcpServer(): Promise<string> {
    throw new Error("not implemented");
  }

  async listMcpServers(): Promise<never[]> {
    return [];
  }

  async inspectMcpServer(): Promise<never> {
    throw new Error("not implemented");
  }

  async listMcpTools(): Promise<never[]> {
    return [];
  }

  async listMcpResources(): Promise<never[]> {
    return [];
  }

  async readMcpResource(): Promise<JsonValue> {
    throw new Error("not implemented");
  }

  async listCachedMcpPrompts(): Promise<never[]> {
    return [];
  }

  async listMcpPrompts(): Promise<never[]> {
    return [];
  }

  async getMcpPrompt(): Promise<JsonValue> {
    throw new Error("not implemented");
  }
}

// Regression test for the slot-overwrite race: pollPendingBackgroundToolExecution used to
// clear the background slot, then await async work (side effects + archive persist) before
// startNextDeferredBackgroundToolExecution. An early execution scheduling into the
// momentarily-free slot during that gap was overwritten by the deferred start, and its later
// settle was discarded (slot mismatch) — its tool result never reached historyStore.
// The fix keeps the finished execution occupying the slot until the next one starts, so the
// late schedule defers instead of overwriting, and its result lands.
test("background slot handoff during commit gap defers late schedules without losing results", async () => {
  const executor = new DeferredShellExecutor();
  const turn: RuntimeTurnContext<ShellToolRequest> = {
    requestTrace: [],
    toolExecutions: [],
    compactions: [],
    autoCompactAttempts: 0,
    deferredUserGuidances: [],
    autoReviewCache: new Map(),
  };
  const state: TestState = { messages: [] };

  let releaseArchiveWrite: (() => void) | undefined;
  const archiveGate = new Promise<void>((resolve) => {
    releaseArchiveWrite = resolve;
  });

  const runtime = {
    options: {
      toolExecutor: executor,
      // Hold the archive write inside pollCommit's async gap until we release it.
      persistToolOutputArchive: async () => {
        await archiveGate;
        return undefined;
      },
      createContinuationState: (history: readonly LlmMessage[]) => {
        state.messages = history
          .filter((message) => message.role === "tool")
          .map(
            (message) =>
              `${message.toolCallId}:${message.content
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("")}`,
          );
        return state;
      },
      appendToolResultMessage: (currentState: TestState, toolCallId: string, content: string) => {
        currentState.messages.push(`${toolCallId}:${content}`);
        return currentState;
      },
    },
    historyStore: [],
    pendingBackgroundToolStatusStore: undefined,
    pendingBackgroundToolExecution: undefined,
    deferredBackgroundToolExecutions: [],
    completedManualToolCommandResultStore: undefined,
    emitEvent: (_event: RuntimeEvent<ShellToolRequest>) => {},
    startToolAgentRoundAsync: () => {},
    startStreamingRound: async () => {},
    queuePendingToolCallContinuation: () => {},
    processToolCallsAsync: async () => {},
  } as unknown as BackgroundToolsRuntime<unknown, TestState, ShellToolRequest>;

  const call = (command: string): ShellToolRequest => ({ name: "shell", command });

  // call_1 takes the slot; call_2 defers.
  scheduleBackgroundToolExecutionAsync(runtime, "run", state, call("first"), "call_1", "shell", "{}", turn);
  scheduleBackgroundToolExecutionAsync(runtime, "run", state, call("second"), "call_2", "shell", "{}", turn);
  assert.equal(runtime.deferredBackgroundToolExecutions.length, 1);

  // Complete call_1; its settle stores output on the pending record.
  executor.completions.get("first")?.();
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Start the commit of call_1. It clears the slot, then blocks on the held archive write.
  const commit = pollPendingBackgroundToolExecution(runtime);
  // Let the commit reach the held archive write inside the gap.
  await new Promise((resolve) => setTimeout(resolve, 0));

  // The finished call_1 still occupies the slot during the commit gap, so the early
  // execution for call_3 defers instead of starting (and being overwritten later).
  scheduleBackgroundToolExecutionAsync(runtime, "run", state, call("third"), "call_3", "shell", "{}", turn);
  assert.equal(
    runtime.pendingBackgroundToolExecution?.kind === "tool-call"
      ? runtime.pendingBackgroundToolExecution.toolCallId
      : undefined,
    "call_1",
  );
  assert.equal(runtime.deferredBackgroundToolExecutions.length, 2);

  // Release the archive write: pollCommit resumes and startNextDeferred starts call_2.
  releaseArchiveWrite?.();
  await commit;
  assert.equal(
    runtime.pendingBackgroundToolExecution?.kind === "tool-call"
      ? runtime.pendingBackgroundToolExecution.toolCallId
      : undefined,
    "call_2",
  );

  // Drain call_2, then call_3.
  executor.completions.get("second")?.();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await pollPendingBackgroundToolExecution(runtime);
  executor.completions.get("third")?.();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await pollPendingBackgroundToolExecution(runtime);

  const toolResultIds = runtime.historyStore
    .filter((message) => message.role === "tool")
    .map((message) => message.toolCallId);

  // No result is lost: every scheduled call lands in history.
  assert.deepEqual(toolResultIds, ["call_1", "call_2", "call_3"]);
});

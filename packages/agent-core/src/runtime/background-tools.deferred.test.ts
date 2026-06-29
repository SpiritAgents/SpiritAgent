import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createToolExecutionTextOutput,
  type AuthorizationDecision,
  type JsonValue,
  type ToolExecutionOutput,
  type ToolExecutor,
} from '../ports.js';
import {
  pollPendingBackgroundToolExecution,
  scheduleBackgroundToolExecutionAsync,
  type BackgroundToolsRuntime,
} from './background-tools.js';
import type { RuntimeEvent, RuntimeTurnContext } from './types.js';

interface ShellToolRequest {
  name: 'shell';
  command: string;
}

type TestState = { messages: string[] };

class DeferredShellExecutor implements ToolExecutor<ShellToolRequest> {
  readonly completions = new Map<string, () => void>();

  toolDefinitionsJson(): JsonValue {
    return [];
  }

  async parseCommand(): Promise<ShellToolRequest> {
    throw new Error('not implemented');
  }

  async requestFromFunctionCall(): Promise<ShellToolRequest> {
    throw new Error('not implemented');
  }

  async authorize(): Promise<AuthorizationDecision> {
    return { kind: 'allowed' };
  }

  async trust(): Promise<void> {}

  async execute(request: ShellToolRequest): Promise<ToolExecutionOutput> {
    await new Promise<void>((resolve) => {
      this.completions.set(request.command, resolve);
    });
    return createToolExecutionTextOutput(`done:${request.command}`);
  }

  shouldExecuteInBackground(request: ShellToolRequest): boolean {
    return request.name === 'shell';
  }

  startMcpBackgroundRefresh(): void {}

  mcpStatusSnapshot() {
    return {
      revision: 0,
      state: 'idle' as const,
      configuredServers: 0,
      loadedServers: 0,
      cachedTools: 0,
    };
  }

  async addMcpServer(): Promise<string> {
    throw new Error('not implemented');
  }

  async listMcpServers(): Promise<never[]> {
    return [];
  }

  async inspectMcpServer(): Promise<never> {
    throw new Error('not implemented');
  }

  async listMcpTools(): Promise<never[]> {
    return [];
  }

  async listMcpResources(): Promise<never[]> {
    return [];
  }

  async readMcpResource(): Promise<JsonValue> {
    throw new Error('not implemented');
  }

  async listCachedMcpPrompts(): Promise<never[]> {
    return [];
  }

  async listMcpPrompts(): Promise<never[]> {
    return [];
  }

  async getMcpPrompt(): Promise<JsonValue> {
    throw new Error('not implemented');
  }
}

test('scheduleBackgroundToolExecutionAsync defers while background slot is busy', async () => {
  const executor = new DeferredShellExecutor();
  const turn: RuntimeTurnContext<ShellToolRequest> = {
    requestTrace: [],
    toolExecutions: [],
    compactions: [],
    autoCompactAttempts: 0,
    deferredUserGuidances: [],
  };
  const state: TestState = { messages: [] };
  const runtime = {
    options: {
      toolExecutor: executor,
      appendToolResultMessage: (
        currentState: TestState,
        toolCallId: string,
        content: string,
      ) => {
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

  const firstRequest: ShellToolRequest = { name: 'shell', command: 'first' };
  const secondRequest: ShellToolRequest = { name: 'shell', command: 'second' };

  scheduleBackgroundToolExecutionAsync(
    runtime,
    'run',
    state,
    firstRequest,
    'call_1',
    'shell',
    '{"command":"first"}',
    turn,
  );
  scheduleBackgroundToolExecutionAsync(
    runtime,
    'run',
    state,
    secondRequest,
    'call_2',
    'shell',
    '{"command":"second"}',
    turn,
  );

  assert.equal(runtime.deferredBackgroundToolExecutions.length, 1);
  assert.equal(runtime.pendingBackgroundToolExecution?.kind, 'tool-call');
  assert.equal(
    runtime.pendingBackgroundToolExecution?.kind === 'tool-call'
      ? runtime.pendingBackgroundToolExecution.toolCallId
      : undefined,
    'call_1',
  );

  executor.completions.get('first')?.();
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  await pollPendingBackgroundToolExecution(runtime);

  assert.equal(runtime.deferredBackgroundToolExecutions.length, 0);
  assert.equal(
    runtime.pendingBackgroundToolExecution?.kind === 'tool-call'
      ? runtime.pendingBackgroundToolExecution.toolCallId
      : undefined,
    'call_2',
  );
  assert.deepEqual(state.messages, ['call_1:done:first']);

  executor.completions.get('second')?.();
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  await pollPendingBackgroundToolExecution(runtime);

  assert.equal(runtime.pendingBackgroundToolExecution, undefined);
  assert.deepEqual(state.messages, ['call_1:done:first', 'call_2:done:second']);
});

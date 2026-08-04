import { randomUUID } from 'node:crypto';

import type {
  ChatArchive,
  JsonValue,
  LlmActiveSkill,
  PendingAssistantAux,
  PendingMcpResource,
  PendingWorkspaceFile,
  RuntimeApprovalDecision,
  RuntimeEvent,
  RuntimePendingApproval,
  RuntimePendingQuestions,
  RuntimeSubagentSessionArchiveEntry,
  RuntimeSubagentSessionSummary,
  RuntimeTurnResult,
} from '@spiritagent/agent-core';
import type { AskQuestionsResult } from '@spiritagent/agent-core';
import type { BridgeRuntimeSnapshot } from '@spiritagent/agent-core/host-bridge';
import type {
  WorkspaceCapabilityTrustDecision,
  WorkspaceCapabilityTrustRequest,
} from '@spiritagent/host-internal';
import type { ModelRef } from '@spiritagent/host-internal';
import {
  connectOrSpawnServer,
  type ServerNotificationListener,
  type ServerRpcClient,
} from '@spiritagent/server/client';

import type { DesktopToolRequest } from './contracts.js';
import type { DesktopRuntime } from './runtime.js';

interface RemoteDesktopRuntimeInput {
  dataDir: string;
  workspaceRoot: string;
  modelRef: ModelRef;
  agentMode: 'agent' | 'plan' | 'ask' | 'debug';
  archive: ChatArchive;
  approvalLevel: 'default' | 'auto-approval' | 'full-approval';
  todoSessionKey: string;
  /** Resolved chat file path for multi-host session identity. */
  conversationKey?: string;
  onActivity?: () => void;
  onWorkspaceCapabilityTrustRequested?: (
    requestId: string,
    request: WorkspaceCapabilityTrustRequest,
  ) => void;
  onRemoteUserTurnSubmitted?: (input: {
    text: string;
    explicitWorkspaceFiles: PendingWorkspaceFile[];
  }) => void;
  onFileChange?: (change: unknown) => void;
}

interface SessionCreateResult {
  sessionId: string;
}

interface SessionAttachResult {
  session: { sessionId: string };
  snapshot: BridgeRuntimeSnapshot;
}

interface SessionPollResult {
  snapshot: BridgeRuntimeSnapshot;
}

interface SessionTurnFinishedNotification {
  sessionId: string;
  stopReason: 'completed' | 'failed' | 'cancelled';
  result?:
    | { kind: 'completed'; assistantText: string; toolExecutions: unknown[] }
    | { kind: 'failed'; error: string; toolExecutions: unknown[] };
}

const EMPTY_SNAPSHOT: BridgeRuntimeSnapshot = {
  pendingImagePaths: [],
  pendingMcpResources: [],
  hasPendingApproval: false,
  hasPendingManualApproval: false,
  hasPendingQuestions: false,
  childSessions: [],
  isBusy: false,
  loopEnabled: false,
  approvalLevel: 'default',
};

let sharedClientPromise: Promise<ServerRpcClient> | undefined;

async function sharedDesktopServerClient(dataDir: string): Promise<ServerRpcClient> {
  if (!sharedClientPromise) {
    const connecting = connectOrSpawnServer({
      dataDir,
      forwardStderr: Boolean(process.env.VITE_DEV_SERVER_URL?.trim()),
    })
      .then(async ({ client }) => {
        await client.call('server.initialize', {
          clientKind: 'desktop',
          clientId: `desktop-${process.pid}`,
        });
        client.onDisconnect(() => {
          if (sharedClientPromise === connecting) {
            sharedClientPromise = undefined;
          }
        });
        return client;
      })
      .catch((error) => {
        sharedClientPromise = undefined;
        throw error;
      });
    sharedClientPromise = connecting;
  }
  return sharedClientPromise;
}

export function desktopUsesDaemonRuntime(): boolean {
  return process.env.SPIRIT_INPROCESS_HOST !== '1';
}

/** Close the process-wide daemon WebSocket so the server can idle-exit. */
export async function closeSharedDesktopServerClient(): Promise<void> {
  const pending = sharedClientPromise;
  sharedClientPromise = undefined;
  if (!pending) {
    return;
  }
  try {
    const client = await pending;
    client.close();
  } catch {
    // Connect/init may have failed; nothing left to close.
  }
}

function isConversationKeyAttachMiss(error: unknown): boolean {
  return error instanceof Error && error.message.includes('no live session for conversationKey');
}

function buildRemoteDesktopRuntime(
  client: ServerRpcClient,
  sessionId: string,
  input: Pick<
    RemoteDesktopRuntimeInput,
    | 'archive'
    | 'onActivity'
    | 'onWorkspaceCapabilityTrustRequested'
    | 'onRemoteUserTurnSubmitted'
    | 'onFileChange'
  >,
): RemoteDesktopRuntime {
  return new RemoteDesktopRuntime(
    client,
    sessionId,
    input.archive,
    input.onActivity,
    input.onWorkspaceCapabilityTrustRequested,
    input.onRemoteUserTurnSubmitted,
    input.onFileChange,
  );
}

async function applyRemoteSessionPreferences(
  runtime: RemoteDesktopRuntime,
  input: Pick<
    RemoteDesktopRuntimeInput,
    'approvalLevel' | 'todoSessionKey' | 'archive'
  >,
): Promise<void> {
  await runtime.clientCall('session.setApprovalLevel', { approvalLevel: input.approvalLevel });
  await runtime.clientCall('session.setTodoSessionKey', { sessionKey: input.todoSessionKey });
  if (typeof input.archive.loopEnabled === 'boolean') {
    runtime.setLoopEnabled(input.archive.loopEnabled);
  }
}

export async function attachRemoteDesktopRuntime(
  input: RemoteDesktopRuntimeInput & { conversationKey: string },
): Promise<DesktopRuntime> {
  const client = await sharedDesktopServerClient(input.dataDir);
  const attached = await client.call<SessionAttachResult>('session.attach', {
    conversationKey: input.conversationKey,
  });
  const runtime = buildRemoteDesktopRuntime(client, attached.session.sessionId, input);
  try {
    await runtime.initializeFromSnapshot(attached.snapshot);
    await applyRemoteSessionPreferences(runtime, input);
    return runtime as unknown as DesktopRuntime;
  } catch (error) {
    await runtime.close().catch(() => undefined);
    throw error;
  }
}

export async function createRemoteDesktopRuntime(
  input: RemoteDesktopRuntimeInput,
): Promise<DesktopRuntime> {
  const client = await sharedDesktopServerClient(input.dataDir);
  const created = await client.call<SessionCreateResult>('session.create', {
    workspaceRoot: input.workspaceRoot,
    modelRef: input.modelRef,
    agentMode: input.agentMode,
    approvalLevel: input.approvalLevel,
    todoSessionKey: input.todoSessionKey,
    ...(input.conversationKey ? { conversationKey: input.conversationKey } : {}),
  });
  if (input.conversationKey) {
    await client.call('session.attach', { conversationKey: input.conversationKey });
  }
  const runtime = buildRemoteDesktopRuntime(client, created.sessionId, input);
  try {
    await runtime.initialize();
    return runtime as unknown as DesktopRuntime;
  } catch (error) {
    await runtime.close().catch(() => undefined);
    throw error;
  }
}

/** Attach an existing live session, or create and hydrate when none is registered. */
export async function openRemoteDesktopRuntime(
  input: RemoteDesktopRuntimeInput & { conversationKey: string },
): Promise<DesktopRuntime> {
  try {
    return await attachRemoteDesktopRuntime(input);
  } catch (error) {
    if (!isConversationKeyAttachMiss(error)) {
      throw error;
    }
  }
  return createRemoteDesktopRuntime(input);
}

export class RemoteDesktopRuntime {
  private snapshot: BridgeRuntimeSnapshot = { ...EMPTY_SNAPSHOT };
  private archive: ChatArchive;
  private events: RuntimeEvent<DesktopToolRequest>[] = [];
  private completedTurnResult:
    | RuntimeTurnResult<unknown, DesktopToolRequest, string>
    | undefined;
  private pendingAssistantTextStore = '';
  private thinkingTextStore = '';
  private compactionTextStore = '';
  private pendingStartedAtStore: number | undefined;
  private pendingLastEventAtStore: number | undefined;
  private streamChunkCounterStore = 0;
  private archiveMessages: ChatArchive['messages'];
  private archiveAssistantAux: ChatArchive['assistantAux'];
  private childEventDrains: Array<{
    sessionId: string;
    parentToolCallId: string;
    events: RuntimeEvent<DesktopToolRequest>[];
  }> = [];
  private readonly childPendingAux = new Map<string, PendingAssistantAux>();
  private archiveRefreshPromise: Promise<void> | undefined;
  private readonly unsubscribe: () => void;
  private readonly pendingLocalClientTurnIds = new Set<string>();
  private mutationTail: Promise<void> = Promise.resolve();
  private mutationError: unknown;

  constructor(
    private readonly client: ServerRpcClient,
    readonly sessionId: string,
    archive: ChatArchive,
    private readonly onActivity?: () => void,
    private readonly onWorkspaceCapabilityTrustRequested?: (
      requestId: string,
      request: WorkspaceCapabilityTrustRequest,
    ) => void,
    private readonly onRemoteUserTurnSubmitted?: (input: {
      text: string;
      explicitWorkspaceFiles: PendingWorkspaceFile[];
    }) => void,
    private readonly onFileChange?: (change: unknown) => void,
  ) {
    this.archive = structuredClone(archive);
    this.archiveMessages = structuredClone(archive.messages);
    this.archiveAssistantAux = structuredClone(archive.assistantAux);
    const listener: ServerNotificationListener = (notification) => {
      this.handleNotification(notification.method, notification.params);
    };
    this.unsubscribe = client.onNotification(listener);
  }

  async initialize(): Promise<void> {
    if (this.archive.llmHistory.length > 0 || (this.archive.subagentSessions?.length ?? 0) > 0) {
      await this.client.call('session.replaceFromArchive', {
        sessionId: this.sessionId,
        archive: this.archive,
      });
    }
    const result = await this.client.call<SessionPollResult>('session.poll', {
      sessionId: this.sessionId,
    });
    await this.initializeFromSnapshot(result.snapshot);
  }

  async initializeFromSnapshot(snapshot: BridgeRuntimeSnapshot): Promise<void> {
    this.snapshot = snapshot;
    await this.refreshArchive();
  }

  async close(): Promise<void> {
    await this.awaitMutations();
    this.unsubscribe();
    await this.client.call('session.detach', { sessionId: this.sessionId });
  }

  async clientCall(method: string, params: Record<string, unknown>): Promise<unknown> {
    return this.client.call(method, { sessionId: this.sessionId, ...params });
  }

  needsProjection(): boolean {
    return this.events.length > 0 || this.completedTurnResult !== undefined;
  }

  async startUserTurnStreaming(
    text: string,
    explicitImages: string[] = [],
    explicitWorkspaceFiles: PendingWorkspaceFile[] = [],
    activeSkills: LlmActiveSkill[] = [],
  ): Promise<void> {
    await this.awaitMutations();
    this.snapshot = { ...this.snapshot, isBusy: true };
    this.pendingStartedAtStore = Date.now();
    const clientTurnId = randomUUID();
    this.pendingLocalClientTurnIds.add(clientTurnId);
    try {
      await this.client.call('session.submitUserTurn', {
        sessionId: this.sessionId,
        clientTurnId,
        text,
        explicitImages,
        explicitWorkspaceFiles,
        activeSkills,
      });
    } catch (error) {
      this.pendingLocalClientTurnIds.delete(clientTurnId);
      throw error;
    }
  }

  async continueAssistantCompletionStreaming(): Promise<void> {
    await this.awaitMutations();
    this.snapshot = { ...this.snapshot, isBusy: true };
    await this.client.call('session.continueAssistantCompletion', { sessionId: this.sessionId });
  }

  async startManualHistoryCompaction(): Promise<void> {
    await this.awaitMutations();
    this.snapshot = { ...this.snapshot, isBusy: true };
    await this.client.call('session.compactHistory', { sessionId: this.sessionId });
  }

  async continuePendingApproval(decision: RuntimeApprovalDecision): Promise<void> {
    await this.awaitMutations();
    await this.client.call('session.replyPendingApproval', {
      sessionId: this.sessionId,
      decision,
    });
  }

  async continuePendingQuestions(result: AskQuestionsResult): Promise<void> {
    await this.awaitMutations();
    await this.client.call('session.replyPendingQuestions', {
      sessionId: this.sessionId,
      result,
    });
  }

  async poll(): Promise<void> {
    await this.awaitMutations();
    await this.archiveRefreshPromise;
  }

  abort(): void {
    this.snapshot = { ...this.snapshot, isBusy: false };
    this.enqueueMutation('session.abort', {});
  }

  replaceFromArchive(archive: ChatArchive): void {
    this.archive = structuredClone(archive);
    this.archiveMessages = structuredClone(archive.messages);
    this.archiveAssistantAux = structuredClone(archive.assistantAux);
    this.enqueueMutation('session.replaceFromArchive', {
      archive,
    });
  }

  replaceHistory(history: ChatArchive['llmHistory']): void {
    this.replaceFromArchive({ ...this.archive, llmHistory: structuredClone(history) });
  }

  toArchive(
    messages: ChatArchive['messages'],
    assistantAux: ChatArchive['assistantAux'],
  ): ChatArchive {
    this.archiveMessages = structuredClone(messages);
    this.archiveAssistantAux = structuredClone(assistantAux);
    return {
      ...structuredClone(this.archive),
      messages: structuredClone(messages),
      assistantAux: structuredClone(assistantAux),
    };
  }

  history(): readonly ChatArchive['llmHistory'][number][] {
    return this.archive.llmHistory;
  }

  requestTrace(): readonly JsonValue[] {
    return [];
  }

  drainEvents(): RuntimeEvent<DesktopToolRequest>[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  takeCompletedTurnResult(): RuntimeTurnResult<unknown, DesktopToolRequest, string> | undefined {
    const result = this.completedTurnResult;
    this.completedTurnResult = undefined;
    return result;
  }

  takeCompletedManualHistoryCompactionResult(): undefined {
    return undefined;
  }

  tickThinkingSpinner(): void {}

  isBusy(): boolean {
    return this.snapshot.isBusy;
  }

  loopEnabled(): boolean {
    return this.snapshot.loopEnabled;
  }

  setLoopEnabled(enabled: boolean): void {
    this.snapshot = { ...this.snapshot, loopEnabled: enabled };
    this.enqueueMutation('session.setLoopEnabled', { enabled });
  }

  hasPendingApproval(): boolean {
    return this.snapshot.hasPendingApproval;
  }

  hasPendingQuestions(): boolean {
    return this.snapshot.hasPendingQuestions;
  }

  currentPendingApproval(): RuntimePendingApproval<DesktopToolRequest, string> | undefined {
    return this.snapshot.currentPendingApproval as RuntimePendingApproval<DesktopToolRequest, string> | undefined;
  }

  currentPendingQuestions(): RuntimePendingQuestions<DesktopToolRequest> | undefined {
    return this.snapshot.currentPendingQuestions as RuntimePendingQuestions<DesktopToolRequest> | undefined;
  }

  pendingUserTurn(): string | undefined {
    return this.snapshot.pendingUserTurn;
  }

  pendingAssistantText(): string {
    return this.pendingAssistantTextStore;
  }

  thinkingText(): string {
    return this.thinkingTextStore;
  }

  compactionText(): string {
    return this.compactionTextStore;
  }

  pendingStartedAt(): number | undefined {
    return this.pendingStartedAtStore;
  }

  pendingLastEventAt(): number | undefined {
    return this.pendingLastEventAtStore;
  }

  streamChunkCounter(): number {
    return this.streamChunkCounterStore;
  }

  pendingAuxState(): PendingAssistantAux | undefined {
    return this.snapshot.pendingAuxState;
  }

  pendingImagePaths(): readonly string[] {
    return this.snapshot.pendingImagePaths;
  }

  pendingMcpResources(): readonly PendingMcpResource[] {
    return this.snapshot.pendingMcpResources;
  }

  backgroundToolStatus(): string | undefined {
    return this.snapshot.backgroundToolStatus;
  }

  childSessions(): readonly RuntimeSubagentSessionSummary[] {
    return this.snapshot.childSessions;
  }

  childSessionArchives(): readonly RuntimeSubagentSessionArchiveEntry[] {
    return (this.archive.subagentSessions ?? []) as RuntimeSubagentSessionArchiveEntry[];
  }

  childSessionArchive(sessionId: string): RuntimeSubagentSessionArchiveEntry | undefined {
    return this.childSessionArchives().find((entry) => entry.summary.sessionId === sessionId);
  }

  childSessionPendingAuxState(sessionId: string): PendingAssistantAux | undefined {
    return this.childPendingAux.get(sessionId);
  }

  drainActiveChildSessionEvents(): Array<{
    sessionId: string;
    parentToolCallId: string;
    events: RuntimeEvent<DesktopToolRequest>[];
  }> {
    const drains = this.childEventDrains;
    this.childEventDrains = [];
    return drains;
  }

  private handleNotification(method: string, rawParams: unknown): void {
    if (!rawParams || typeof rawParams !== 'object') {
      return;
    }
    const params = rawParams as Record<string, unknown>;
    if (params['sessionId'] !== this.sessionId) {
      return;
    }
    if (method === 'runtime.event') {
      const event = params['event'] as RuntimeEvent<DesktopToolRequest>;
      if (event) {
        this.applyRuntimeEvent(event);
        this.events.push(event);
        this.onActivity?.();
      }
      return;
    }
    if (method === 'session.userTurnSubmitted' && typeof params['text'] === 'string') {
      const clientTurnId = typeof params['clientTurnId'] === 'string'
        ? params['clientTurnId']
        : undefined;
      this.archive.llmHistory.push({
        role: 'user',
        content: params['text'],
        imagePaths: [],
      });
      if (clientTurnId && this.pendingLocalClientTurnIds.delete(clientTurnId)) {
        return;
      }
      this.onRemoteUserTurnSubmitted?.({
        text: params['text'],
        explicitWorkspaceFiles: Array.isArray(params['explicitWorkspaceFiles'])
          ? params['explicitWorkspaceFiles'] as PendingWorkspaceFile[]
          : [],
      });
      this.onActivity?.();
      return;
    }
    if (method === 'session.snapshot' && params['snapshot']) {
      const incoming = params['snapshot'] as BridgeRuntimeSnapshot;
      this.snapshot = { ...incoming };
      this.onActivity?.();
      return;
    }
    if (method === 'session.turnFinished') {
      this.applyTurnFinished(params as unknown as SessionTurnFinishedNotification);
      this.onActivity?.();
      return;
    }
    if (method === 'session.fileChanged') {
      this.onFileChange?.(params['change']);
      return;
    }
    if (method === 'session.subagentEvents' && Array.isArray(params['drains'])) {
      for (const rawDrain of params['drains']) {
        if (!rawDrain || typeof rawDrain !== 'object') {
          continue;
        }
        const drain = rawDrain as Record<string, unknown>;
        const childSessionId = typeof drain['sessionId'] === 'string'
          ? drain['sessionId']
          : '';
        const parentToolCallId = typeof drain['parentToolCallId'] === 'string'
          ? drain['parentToolCallId']
          : '';
        if (!childSessionId || !parentToolCallId) {
          continue;
        }
        if (drain['pendingAux']) {
          this.childPendingAux.set(childSessionId, drain['pendingAux'] as PendingAssistantAux);
        } else {
          this.childPendingAux.delete(childSessionId);
        }
        const events = Array.isArray(drain['events'])
          ? drain['events'] as RuntimeEvent<DesktopToolRequest>[]
          : [];
        if (events.length > 0) {
          this.childEventDrains.push({ sessionId: childSessionId, parentToolCallId, events });
        }
      }
      this.onActivity?.();
      return;
    }
    if (
      method === 'workspace.trustRequested'
      && typeof params['requestId'] === 'string'
      && params['request']
    ) {
      this.onWorkspaceCapabilityTrustRequested?.(
        params['requestId'],
        params['request'] as WorkspaceCapabilityTrustRequest,
      );
      this.onActivity?.();
    }
  }

  private applyRuntimeEvent(event: RuntimeEvent<DesktopToolRequest>): void {
    this.pendingLastEventAtStore = Date.now();
    switch (event.kind) {
      case 'begin-assistant-response':
        this.pendingAssistantTextStore = '';
        this.thinkingTextStore = '';
        this.compactionTextStore = '';
        this.streamChunkCounterStore = 0;
        break;
      case 'assistant-chunk':
        this.pendingAssistantTextStore += event.text;
        this.streamChunkCounterStore += 1;
        break;
      case 'replace-pending-assistant':
        this.pendingAssistantTextStore = event.text;
        break;
      case 'update-pending-assistant-thinking':
        this.thinkingTextStore = event.text;
        break;
      case 'update-pending-assistant-compaction':
        this.compactionTextStore = event.text;
        break;
      case 'approval-requested':
        this.snapshot = {
          ...this.snapshot,
          hasPendingApproval: true,
          currentPendingApproval: event.approval as never,
        };
        break;
      case 'questions-requested':
        this.snapshot = {
          ...this.snapshot,
          hasPendingQuestions: true,
          currentPendingQuestions: event.questions as never,
        };
        break;
      case 'approval-resolved':
        this.snapshot = {
          ...this.snapshot,
          hasPendingApproval: false,
          currentPendingApproval: undefined,
        };
        break;
      default:
        break;
    }
  }

  private applyTurnFinished(params: SessionTurnFinishedNotification): void {
    this.snapshot = { ...this.snapshot, isBusy: false };
    const result = params.result;
    if (result?.kind === 'completed') {
      this.completedTurnResult = {
        kind: 'completed',
        assistantText: result.assistantText,
        state: undefined,
        requestTrace: [],
        toolExecutions: result.toolExecutions as never,
        compactions: [],
      };
    } else if (result?.kind === 'failed') {
      this.completedTurnResult = {
        kind: 'failed',
        error: result.error,
        requestTrace: [],
        toolExecutions: result.toolExecutions as never,
        compactions: [],
      };
    }
    this.archiveRefreshPromise = this.refreshArchive().finally(() => {
      this.archiveRefreshPromise = undefined;
    });
  }

  private async refreshArchive(): Promise<void> {
    this.archive = await this.client.call<ChatArchive>('session.exportArchive', {
      sessionId: this.sessionId,
      messages: this.archiveMessages,
      assistantAux: this.archiveAssistantAux,
    });
  }

  private enqueueMutation(method: string, params: Record<string, unknown>): void {
    const operation = this.mutationTail.then(async () => {
      await this.clientCall(method, params);
    });
    this.mutationTail = operation.catch((error) => {
      this.mutationError = error;
    });
  }

  private async awaitMutations(): Promise<void> {
    await this.mutationTail;
    if (this.mutationError !== undefined) {
      const error = this.mutationError;
      this.mutationError = undefined;
      throw error;
    }
  }
}

export async function closeRemoteDesktopRuntime(runtime: unknown): Promise<void> {
  if (runtime instanceof RemoteDesktopRuntime) {
    await runtime.close();
  }
}

export function remoteDesktopRuntimeNeedsProjection(runtime: unknown): boolean {
  return runtime instanceof RemoteDesktopRuntime && runtime.needsProjection();
}

export async function abortRemoteDesktopShell(
  runtime: unknown,
  toolCallId: string,
): Promise<boolean | undefined> {
  if (!(runtime instanceof RemoteDesktopRuntime)) {
    return undefined;
  }
  const result = await runtime.clientCall('session.abortShell', { toolCallId }) as {
    aborted?: boolean;
  };
  return result.aborted === true;
}

export async function exportRemoteDesktopState(runtime: unknown): Promise<{
  apiMessages: unknown[];
  requestTrace: unknown[];
  systemPrompts: Record<string, unknown>;
} | undefined> {
  if (!(runtime instanceof RemoteDesktopRuntime)) {
    return undefined;
  }
  return runtime.clientCall('session.exportState', {}) as Promise<{
    apiMessages: unknown[];
    requestTrace: unknown[];
    systemPrompts: Record<string, unknown>;
  }>;
}

export async function setRemoteDesktopApprovalLevel(
  runtime: unknown,
  approvalLevel: 'default' | 'auto-approval' | 'full-approval',
): Promise<boolean> {
  if (!(runtime instanceof RemoteDesktopRuntime)) {
    return false;
  }
  await runtime.clientCall('session.setApprovalLevel', { approvalLevel });
  return true;
}

export async function runRemoteDesktopSessionStart(
  runtime: unknown,
  source: 'startup' | 'resume' | 'open',
): Promise<boolean> {
  if (!(runtime instanceof RemoteDesktopRuntime)) {
    return false;
  }
  await runtime.clientCall('session.runSessionStart', { source });
  return true;
}

export async function runRemoteDesktopSessionEnd(
  runtime: unknown,
  reason: 'abort' | 'close' | 'switch',
): Promise<boolean> {
  if (!(runtime instanceof RemoteDesktopRuntime)) {
    return false;
  }
  await runtime.clientCall('session.runSessionEnd', { reason });
  return true;
}

export async function replyRemoteWorkspaceCapabilityTrust(
  runtime: unknown,
  requestId: string,
  decision: WorkspaceCapabilityTrustDecision,
): Promise<boolean> {
  if (!(runtime instanceof RemoteDesktopRuntime)) {
    return false;
  }
  await runtime.clientCall('session.replyWorkspaceCapabilityTrust', { requestId, decision });
  return true;
}
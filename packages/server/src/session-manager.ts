import { randomUUID } from 'node:crypto';

import type { JsonValue, RuntimeEvent, SpiritAgentMode } from '@spiritagent/agent-core';
import type { BridgeRuntimeSnapshot } from '@spiritagent/agent-core/host-bridge';
import type { ApprovalLevel } from '@spiritagent/host-internal';

import {
  createServerRuntime,
  type ServerClientKind,
  type ServerRuntimeResult,
} from './runtime-factory.js';
import { buildServerSnapshot } from './snapshot-projector.js';

export type TurnStopReason = 'completed' | 'failed' | 'cancelled';

export interface ServerSessionInfo {
  sessionId: string;
  workspaceRoot: string;
  hostKind: ServerClientKind;
  createdAt: string;
  title?: string;
  isBusy: boolean;
  approvalLevel: ApprovalLevel;
  queuedTurns: number;
}

interface QueuedUserTurn {
  text: string;
  explicitImages: string[];
  activeSkills: Parameters<ServerRuntimeResult['runtime']['startUserTurnStreaming']>[3];
}

export interface WorkspaceCapabilityTrustRequestPayload {
  workspaceRoot: string;
  contentHash: string;
  hashChanged: boolean;
  hooks: Array<{ event: string; command: string; resolvedPath: string }>;
}

export type WorkspaceCapabilityTrustDecision = 'allowOnce' | 'deny' | 'alwaysTrust';

interface PendingTrustRequest {
  sessionId: string;
  resolve: (decision: WorkspaceCapabilityTrustDecision) => void;
  timer: NodeJS.Timeout;
}

interface ServerSession {
  info: ServerSessionInfo;
  runtimeResult: ServerRuntimeResult;
  /** Incremented per turn; stale completions drop their broadcast. */
  turnGeneration: number;
  queue: QueuedUserTurn[];
  pump: NodeJS.Timeout;
  /** A turn/compaction is in flight (set by the initiator, cleared on finish). */
  turnActive: boolean;
  /** Ticks spent idle while turnActive — guards against result-less endings. */
  idleTicksWhileActive: number;
  polling: boolean;
}

export interface SessionManagerCallbacks {
  /** Broadcast a runtime event to every connected client. */
  broadcastRuntimeEvent: (sessionId: string, event: RuntimeEvent<JsonValue>) => void;
  /** Broadcast turn completion (terminal state of a submitUserTurn). */
  broadcastTurnFinished: (sessionId: string, stopReason: TurnStopReason) => void;
  /** Broadcast a fresh session projection (throttled by the caller). */
  broadcastSnapshot: (sessionId: string, snapshot: BridgeRuntimeSnapshot) => void;
  /** Route a workspace capability trust prompt to clients; first reply wins. */
  broadcastTrustRequest: (
    sessionId: string,
    requestId: string,
    request: WorkspaceCapabilityTrustRequestPayload,
  ) => void;
  log?: (message: string) => void;
}

export interface CreateSessionParams {
  workspaceRoot: string;
  hostKind: ServerClientKind;
  approvalLevel?: ApprovalLevel;
}

export interface SubmitUserTurnParams {
  text: string;
  explicitImages?: string[];
  activeSkills?: QueuedUserTurn['activeSkills'];
}

export type SubmitUserTurnOutcome =
  | { accepted: true }
  | { queued: true; position: number };

const TRUST_REQUEST_TIMEOUT_MS = 120_000;
const PUMP_INTERVAL_MS = 25;
/**
 * Idle ticks (×25ms) with an active turn but no pending work before the turn
 * is declared cancelled. Approval resolution flickers idle for one await
 * boundary — far below this grace window.
 */
const IDLE_GRACE_TICKS = 40;

/**
 * Owns live sessions. Each session has its own AgentRuntime and a 25ms pump
 * (the Desktop session-pump model): the pump drives `runtime.poll()` and
 * harvests terminal results, so turns survive transient idle windows inside
 * the turn machine (e.g. the await boundary in approval resolution).
 * Events reach clients in real time via `onEvent` push.
 *
 * Interaction routing: approvals / questions / workspace trust prompts are
 * broadcast to every connected client; the first reply wins. When the last
 * client disconnects, pending interactions are denied/skipped so runtimes
 * never park forever.
 */
export class SessionManager {
  private readonly sessions = new Map<string, ServerSession>();
  private readonly pendingTrustRequests = new Map<string, PendingTrustRequest>();
  private readonly spiritDataDir: string;

  constructor(
    spiritDataDir: string,
    private readonly callbacks: SessionManagerCallbacks,
  ) {
    this.spiritDataDir = spiritDataDir;
  }

  async createSession(params: CreateSessionParams): Promise<ServerSessionInfo> {
    const sessionId = `sess_${randomUUID().replaceAll('-', '')}`;
    const runtimeResult = await createServerRuntime({
      workspaceRoot: params.workspaceRoot,
      spiritDataDir: this.spiritDataDir,
      sessionKey: sessionId,
      hostKind: params.hostKind === 'web' ? 'cli' : params.hostKind,
      approvalLevel: params.approvalLevel ?? 'default',
      onEvent: (event) => this.handleRuntimeEvent(sessionId, event),
      requestWorkspaceCapabilityTrust: (request) =>
        this.requestWorkspaceCapabilityTrust(sessionId, request),
      ...(this.callbacks.log ? { log: this.callbacks.log } : {}),
    });

    const info: ServerSessionInfo = {
      sessionId,
      workspaceRoot: params.workspaceRoot,
      hostKind: params.hostKind,
      createdAt: new Date().toISOString(),
      isBusy: false,
      approvalLevel: params.approvalLevel ?? 'default',
      queuedTurns: 0,
    };
    const session: ServerSession = {
      info,
      runtimeResult,
      turnGeneration: 0,
      queue: [],
      pump: undefined as unknown as NodeJS.Timeout,
      turnActive: false,
      idleTicksWhileActive: 0,
      polling: false,
    };
    session.pump = setInterval(() => this.tickSession(session), PUMP_INTERVAL_MS);
    session.pump.unref();
    this.sessions.set(sessionId, session);
    return { ...info };
  }

  listSessions(): ServerSessionInfo[] {
    return [...this.sessions.values()].map((session) => this.projectInfo(session));
  }

  getSession(sessionId: string): ServerSessionInfo | undefined {
    const session = this.sessions.get(sessionId);
    return session ? this.projectInfo(session) : undefined;
  }

  snapshot(sessionId: string): BridgeRuntimeSnapshot {
    return buildServerSnapshot(this.requireSession(sessionId).runtimeResult);
  }

  private projectInfo(session: ServerSession): ServerSessionInfo {
    return {
      ...session.info,
      isBusy: session.runtimeResult.runtime.isBusy(),
      queuedTurns: session.queue.length,
    };
  }

  private requireSession(sessionId: string): ServerSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`session not found: ${sessionId}`);
    }
    return session;
  }

  private handleRuntimeEvent(sessionId: string, event: RuntimeEvent<JsonValue>): void {
    this.callbacks.broadcastRuntimeEvent(sessionId, event);
    // Approval/question lifecycle changes are exactly when clients need a
    // fresh projection (to open or close the interactive UI).
    if (
      event.kind === 'approval-requested'
      || event.kind === 'approval-resolved'
      || event.kind === 'questions-requested'
    ) {
      const session = this.sessions.get(sessionId);
      if (session) {
        this.callbacks.broadcastSnapshot(sessionId, buildServerSnapshot(session.runtimeResult));
      }
    }
  }

  // ------------------------------------------------------------------ pump

  private tickSession(session: ServerSession): void {
    if (session.polling) {
      return;
    }
    session.polling = true;
    void (async () => {
      const { runtime } = session.runtimeResult;
      await session.runtimeResult.toolExecutor.refreshCaches();
      await runtime.poll();

      const turnResult = runtime.takeCompletedTurnResult();
      if (turnResult && session.turnActive) {
        this.finishTurn(
          session,
          session.turnGeneration,
          turnResult.kind === 'failed' ? 'failed' : 'completed',
        );
        return;
      }
      const compactionResult = runtime.takeCompletedManualHistoryCompactionResult();
      if (compactionResult && session.turnActive) {
        this.finishTurn(session, session.turnGeneration, 'completed');
        return;
      }

      if (session.turnActive) {
        const idle = !runtime.isBusy()
          && !runtime.hasPendingApproval()
          && !runtime.hasPendingQuestions();
        session.idleTicksWhileActive = idle ? session.idleTicksWhileActive + 1 : 0;
        if (session.idleTicksWhileActive >= IDLE_GRACE_TICKS) {
          // The turn machine went idle without producing a result (should not
          // happen outside abort); release the session instead of hanging.
          this.finishTurn(session, session.turnGeneration, 'cancelled');
          return;
        }
      } else {
        session.idleTicksWhileActive = 0;
      }

      this.drainQueue(session);
    })()
      .catch((err) => {
        this.callbacks.log?.(
          `session ${session.info.sessionId} pump error: ${err instanceof Error ? err.message : String(err)}`,
        );
      })
      .finally(() => {
        session.polling = false;
      });
  }

  // ---------------------------------------------------------------- turns

  async submitUserTurn(
    sessionId: string,
    params: SubmitUserTurnParams,
  ): Promise<SubmitUserTurnOutcome> {
    const session = this.requireSession(sessionId);
    const { runtime } = session.runtimeResult;
    const text = params.text.trim();
    if (!text) {
      throw new Error('empty user turn');
    }

    const turn: QueuedUserTurn = {
      text: params.text,
      explicitImages: params.explicitImages ?? [],
      activeSkills: params.activeSkills ?? [],
    };

    if (runtime.isBusy() || session.turnActive) {
      // Busy sessions queue; the queue drains when the current turn lands.
      session.queue.push(turn);
      return { queued: true, position: session.queue.length };
    }
    if (runtime.hasPendingApproval() || runtime.hasPendingQuestions()) {
      throw new Error('session has a pending approval or questionnaire; answer it first');
    }

    await this.startTurn(session, turn);
    return { accepted: true };
  }

  private async startTurn(session: ServerSession, turn: QueuedUserTurn): Promise<void> {
    const { runtime } = session.runtimeResult;
    await session.runtimeResult.toolExecutor.refreshCaches();
    session.turnActive = true;
    session.idleTicksWhileActive = 0;
    session.info.isBusy = true;
    session.turnGeneration += 1;

    await runtime.startUserTurnStreaming(
      turn.text,
      turn.explicitImages,
      [],
      turn.activeSkills,
    );
    // The session pump (25ms) drives poll() and harvests the turn result.
  }

  private finishTurn(session: ServerSession, generation: number, stopReason: TurnStopReason): void {
    if (session.turnGeneration !== generation || !session.turnActive) {
      return;
    }
    session.turnActive = false;
    session.idleTicksWhileActive = 0;
    session.info.isBusy = false;
    this.callbacks.broadcastTurnFinished(session.info.sessionId, stopReason);
    this.callbacks.broadcastSnapshot(session.info.sessionId, buildServerSnapshot(session.runtimeResult));
    this.drainQueue(session);
  }

  private drainQueue(session: ServerSession): void {
    const { runtime } = session.runtimeResult;
    if (session.queue.length === 0 || session.turnActive || runtime.isBusy()) {
      return;
    }
    if (runtime.hasPendingApproval() || runtime.hasPendingQuestions()) {
      return;
    }
    const next = session.queue.shift()!;
    this.startTurn(session, next).catch((err) => {
      // Put the turn back and surface the failure as a failed turn.
      session.queue.unshift(next);
      session.turnActive = false;
      session.info.isBusy = false;
      this.callbacks.broadcastTurnFinished(session.info.sessionId, 'failed');
      this.callbacks.log?.(`drainQueue failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  abort(sessionId: string): void {
    const session = this.requireSession(sessionId);
    session.turnGeneration += 1;
    session.runtimeResult.runtime.abort();
    session.turnActive = false;
    session.idleTicksWhileActive = 0;
    session.info.isBusy = false;
    this.callbacks.broadcastTurnFinished(sessionId, 'cancelled');
    this.callbacks.broadcastSnapshot(sessionId, buildServerSnapshot(session.runtimeResult));
    this.drainQueue(session);
  }

  async continueAssistantCompletion(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId);
    const { runtime } = session.runtimeResult;
    if (runtime.isBusy() || session.turnActive) {
      throw new Error('session is busy; wait for the current turn to finish');
    }
    session.turnActive = true;
    session.idleTicksWhileActive = 0;
    session.info.isBusy = true;
    session.turnGeneration += 1;
    await runtime.continueAssistantCompletionStreaming();
  }

  async compactHistory(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId);
    const { runtime } = session.runtimeResult;
    if (runtime.isBusy() || session.turnActive) {
      throw new Error('session is busy; wait for the current turn to finish');
    }
    session.turnActive = true;
    session.idleTicksWhileActive = 0;
    session.info.isBusy = true;
    session.turnGeneration += 1;
    await runtime.startManualHistoryCompaction();
  }

  // ------------------------------------------------------- session config

  async setApprovalLevel(sessionId: string, level: ApprovalLevel): Promise<void> {
    const session = this.requireSession(sessionId);
    session.runtimeResult.setApprovalLevel(level);
    session.info.approvalLevel = level;
  }

  async setAgentMode(sessionId: string, mode: SpiritAgentMode): Promise<void> {
    const session = this.requireSession(sessionId);
    await session.runtimeResult.setAgentMode(mode);
  }

  setLoopEnabled(sessionId: string, enabled: boolean): void {
    const session = this.requireSession(sessionId);
    session.runtimeResult.setLoopEnabled(enabled);
  }

  reset(sessionId: string): void {
    const session = this.requireSession(sessionId);
    session.turnGeneration += 1;
    session.runtimeResult.runtime.abort();
    session.queue = [];
    session.turnActive = false;
    session.runtimeResult.runtime.replaceHistory([]);
    session.info.isBusy = false;
    this.callbacks.broadcastSnapshot(sessionId, buildServerSnapshot(session.runtimeResult));
  }

  rename(sessionId: string, title: string): void {
    const session = this.requireSession(sessionId);
    const trimmed = title.trim();
    if (trimmed) {
      session.info.title = trimmed;
    } else {
      delete session.info.title;
    }
  }

  // ------------------------------------------------------ interactions

  async replyPendingApproval(
    sessionId: string,
    decision: Parameters<ServerRuntimeResult['runtime']['continuePendingApproval']>[0],
  ): Promise<void> {
    const session = this.requireSession(sessionId);
    await session.runtimeResult.runtime.continuePendingApproval(decision);
  }

  async replyPendingQuestions(
    sessionId: string,
    result: Parameters<ServerRuntimeResult['runtime']['continuePendingQuestions']>[0],
  ): Promise<void> {
    const session = this.requireSession(sessionId);
    await session.runtimeResult.runtime.continuePendingQuestions(result);
  }

  private requestWorkspaceCapabilityTrust(
    sessionId: string,
    request: WorkspaceCapabilityTrustRequestPayload,
  ): Promise<WorkspaceCapabilityTrustDecision> {
    return new Promise((resolve) => {
      const requestId = randomUUID();
      const timer = setTimeout(() => {
        this.pendingTrustRequests.delete(requestId);
        resolve('deny');
      }, TRUST_REQUEST_TIMEOUT_MS);
      timer.unref();
      this.pendingTrustRequests.set(requestId, { sessionId, resolve, timer });
      this.callbacks.broadcastTrustRequest(sessionId, requestId, request);
    });
  }

  replyWorkspaceCapabilityTrust(
    requestId: string,
    decision: WorkspaceCapabilityTrustDecision,
  ): void {
    const pending = this.pendingTrustRequests.get(requestId);
    if (!pending) {
      // Already answered (first-responder wins) or timed out.
      return;
    }
    this.pendingTrustRequests.delete(requestId);
    clearTimeout(pending.timer);
    pending.resolve(decision);
  }

  /**
   * Last client disconnected: deny/skip every pending interaction so no
   * runtime parks on input that can never arrive.
   */
  handleNoClientsRemaining(): void {
    for (const session of this.sessions.values()) {
      const { runtime } = session.runtimeResult;
      if (runtime.hasPendingApproval()) {
        runtime
          .continuePendingApproval({
            kind: 'deny',
            resultText: 'All clients disconnected.',
          })
          .catch((err) =>
            this.callbacks.log?.(
              `session ${session.info.sessionId}: deny failed: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
      }
      if (runtime.hasPendingQuestions()) {
        runtime.continuePendingQuestions({ status: 'skipped' }).catch((err) =>
          this.callbacks.log?.(
            `session ${session.info.sessionId}: skip questions failed: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
      }
    }
    for (const [requestId, pending] of this.pendingTrustRequests) {
      this.pendingTrustRequests.delete(requestId);
      clearTimeout(pending.timer);
      pending.resolve('deny');
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    session.turnGeneration += 1;
    session.queue = [];
    clearInterval(session.pump);
    session.runtimeResult.runtime.abort();
    this.sessions.delete(sessionId);
  }

  /** Aborts every session; called on daemon shutdown. */
  shutdown(): void {
    for (const session of this.sessions.values()) {
      session.turnGeneration += 1;
      clearInterval(session.pump);
      session.runtimeResult.runtime.abort();
    }
    this.sessions.clear();
    for (const [requestId, pending] of this.pendingTrustRequests) {
      this.pendingTrustRequests.delete(requestId);
      clearTimeout(pending.timer);
      pending.resolve('deny');
    }
  }
}

import { randomUUID } from 'node:crypto';

import type { JsonValue, RuntimeEvent, SpiritAgentMode } from '@spiritagent/agent-core';
import type { ApprovalLevel } from '@spiritagent/host-internal';

import {
  createServerRuntime,
  type ServerClientKind,
  type ServerRuntimeResult,
} from './runtime-factory.js';

export type TurnStopReason = 'completed' | 'failed' | 'cancelled';

export interface ServerSessionInfo {
  sessionId: string;
  workspaceRoot: string;
  hostKind: ServerClientKind;
  createdAt: string;
  isBusy: boolean;
  approvalLevel: ApprovalLevel;
}

interface ServerSession {
  info: ServerSessionInfo;
  runtimeResult: ServerRuntimeResult;
  /** Incremented per turn; stale waiters drop their completion broadcast. */
  turnGeneration: number;
}

export interface SessionManagerCallbacks {
  /** Broadcast a runtime event to every connected client. */
  broadcastRuntimeEvent: (sessionId: string, event: RuntimeEvent<JsonValue>) => void;
  /** Broadcast turn completion (terminal state of a submitUserTurn). */
  broadcastTurnFinished: (sessionId: string, stopReason: TurnStopReason) => void;
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
  activeSkills?: Parameters<ServerRuntimeResult['runtime']['startUserTurnStreaming']>[3];
}

/**
 * Owns live sessions. Each session has its own AgentRuntime; the turn wait
 * loop (`waitForCompletedTurnResult`) drives `poll()` — there is no separate
 * pump timer, so a session with no active turn consumes no cycles.
 */
export class SessionManager {
  private readonly sessions = new Map<string, ServerSession>();
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
      onEvent: (event) => this.callbacks.broadcastRuntimeEvent(sessionId, event),
      ...(this.callbacks.log ? { log: this.callbacks.log } : {}),
    });

    const info: ServerSessionInfo = {
      sessionId,
      workspaceRoot: params.workspaceRoot,
      hostKind: params.hostKind,
      createdAt: new Date().toISOString(),
      isBusy: false,
      approvalLevel: params.approvalLevel ?? 'default',
    };
    this.sessions.set(sessionId, {
      info,
      runtimeResult,
      turnGeneration: 0,
    });
    return { ...info };
  }

  listSessions(): ServerSessionInfo[] {
    return [...this.sessions.values()].map((session) => ({
      ...session.info,
      isBusy: session.runtimeResult.runtime.isBusy(),
    }));
  }

  getSession(sessionId: string): ServerSessionInfo | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }
    return {
      ...session.info,
      isBusy: session.runtimeResult.runtime.isBusy(),
    };
  }

  private requireSession(sessionId: string): ServerSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`session not found: ${sessionId}`);
    }
    return session;
  }

  async submitUserTurn(sessionId: string, params: SubmitUserTurnParams): Promise<void> {
    const session = this.requireSession(sessionId);
    const { runtime } = session.runtimeResult;
    if (runtime.isBusy()) {
      throw new Error('session is busy; wait for the current turn to finish');
    }
    const text = params.text.trim();
    if (!text) {
      throw new Error('empty user turn');
    }

    await session.runtimeResult.toolExecutor.refreshCaches();
    session.info.isBusy = true;
    const generation = ++session.turnGeneration;

    await runtime.startUserTurnStreaming(
      params.text,
      params.explicitImages ?? [],
      [],
      params.activeSkills ?? [],
    );

    // The wait loop drives runtime.poll() until the turn lands in a terminal
    // state; events stream to clients in real time via onEvent.
    void runtime
      .waitForCompletedTurnResult()
      .then((result) => {
        if (session.turnGeneration !== generation) {
          return;
        }
        session.info.isBusy = false;
        this.callbacks.broadcastTurnFinished(
          sessionId,
          result.kind === 'failed' ? 'failed' : 'completed',
        );
      })
      .catch(() => {
        if (session.turnGeneration !== generation) {
          return;
        }
        // Aborted (or parked without a result): surface as cancelled.
        session.info.isBusy = false;
        this.callbacks.broadcastTurnFinished(sessionId, 'cancelled');
      });
  }

  abort(sessionId: string): void {
    const session = this.requireSession(sessionId);
    session.turnGeneration += 1;
    session.runtimeResult.runtime.abort();
    session.info.isBusy = false;
    this.callbacks.broadcastTurnFinished(sessionId, 'cancelled');
  }

  async setApprovalLevel(sessionId: string, level: ApprovalLevel): Promise<void> {
    const session = this.requireSession(sessionId);
    session.runtimeResult.setApprovalLevel(level);
    session.info.approvalLevel = level;
  }

  async setAgentMode(sessionId: string, mode: SpiritAgentMode): Promise<void> {
    const session = this.requireSession(sessionId);
    await session.runtimeResult.setAgentMode(mode);
  }

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

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    session.turnGeneration += 1;
    session.runtimeResult.runtime.abort();
    this.sessions.delete(sessionId);
  }

  /** Aborts every session; called on daemon shutdown. */
  shutdown(): void {
    for (const session of this.sessions.values()) {
      session.turnGeneration += 1;
      session.runtimeResult.runtime.abort();
    }
    this.sessions.clear();
  }
}

/**
 * Spirit Server protocol surface (Phase 1: server lifecycle).
 *
 * Method names are camelCase JSON-RPC methods. Server→client streaming
 * arrives as notifications, never as RPC responses.
 */

export const PROTOCOL_VERSION = 1;

/** RPC: client handshake after WS connect. */
export const SERVER_INITIALIZE = 'server.initialize';
/** RPC: liveness + build info. */
export const SERVER_HEALTH = 'server.health';
/** Notification: first frame the server sends after a successful upgrade. */
export const SERVER_CONNECTED = 'server.connected';

/** RPC: create a session (owns an AgentRuntime in the daemon). */
export const SESSION_CREATE = 'session.create';
/** RPC: list live sessions. */
export const SESSION_LIST = 'session.list';
/** RPC: close + abort a session. */
export const SESSION_CLOSE = 'session.close';
/** RPC: submit a user turn; streaming arrives via `runtime.event`. */
export const SESSION_SUBMIT_USER_TURN = 'session.submitUserTurn';
/** RPC: abort the current turn. */
export const SESSION_ABORT = 'session.abort';
/** RPC: set approval level (default | auto-approval | full-approval). */
export const SESSION_SET_APPROVAL_LEVEL = 'session.setApprovalLevel';
/** RPC: answer a pending tool approval. */
export const SESSION_REPLY_PENDING_APPROVAL = 'session.replyPendingApproval';
/** RPC: answer pending questions. */
export const SESSION_REPLY_PENDING_QUESTIONS = 'session.replyPendingQuestions';

/** Notification: one agent-core RuntimeEvent for a session. */
export const RUNTIME_EVENT = 'runtime.event';
/** Notification: a submitted turn reached a terminal state. */
export const SESSION_TURN_FINISHED = 'session.turnFinished';

export type ClientKind = 'cli' | 'desktop' | 'web';

export interface ServerInitializeParams {
  clientKind: ClientKind;
  /** Opaque client identifier (e.g. pid + random suffix), for diagnostics. */
  clientId?: string;
  /** Workspace the client intends to work in; used for registry matching. */
  workspaceRoot?: string;
}

export interface ServerInitializeResult {
  protocolVersion: number;
  instanceId: string;
  version: string;
  startedAt: string;
  dataDir: string;
}

export interface ServerHealthResult {
  ok: true;
  instanceId: string;
  pid: number;
  version: string;
  startedAt: string;
  uptimeMs: number;
  connections: number;
}

export interface ServerConnectedParams {
  protocolVersion: number;
  instanceId: string;
  version: string;
}

export type SessionApprovalLevel = 'default' | 'auto-approval' | 'full-approval';

export interface SessionCreateParams {
  workspaceRoot: string;
  approvalLevel?: SessionApprovalLevel;
}

export interface SessionInfo {
  sessionId: string;
  workspaceRoot: string;
  hostKind: ClientKind;
  createdAt: string;
  isBusy: boolean;
  approvalLevel: SessionApprovalLevel;
}

export interface SessionSubmitUserTurnParams {
  sessionId: string;
  text: string;
  explicitImages?: string[];
  activeSkills?: unknown[];
}

export interface RuntimeEventNotificationParams {
  sessionId: string;
  event: unknown;
}

export type TurnStopReason = 'completed' | 'failed' | 'cancelled';

export interface SessionTurnFinishedParams {
  sessionId: string;
  stopReason: TurnStopReason;
}

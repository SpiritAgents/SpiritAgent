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
/** RPC: switch agent mode (agent | plan | ask | debug). */
export const SESSION_SET_MODE = 'session.setMode';
/** RPC: toggle loop mode. */
export const SESSION_SET_LOOP_ENABLED = 'session.setLoopEnabled';
/** RPC: clear history and abort any work in flight. */
export const SESSION_RESET = 'session.reset';
/** RPC: set a display title (live sessions only). */
export const SESSION_RENAME = 'session.rename';
/** RPC: continue assistant completion from history tail. */
export const SESSION_CONTINUE_COMPLETION = 'session.continueAssistantCompletion';
/** RPC: run manual history compaction. */
export const SESSION_COMPACT_HISTORY = 'session.compactHistory';
/** RPC: pull the current session projection (watchdog / headless). */
export const SESSION_POLL = 'session.poll';
/** RPC: answer a workspace capability trust prompt (first reply wins). */
export const SESSION_REPLY_TRUST = 'session.replyWorkspaceCapabilityTrust';

/** Notification: one agent-core RuntimeEvent for a session. */
export const RUNTIME_EVENT = 'runtime.event';
/** Notification: a submitted turn reached a terminal state. */
export const SESSION_TURN_FINISHED = 'session.turnFinished';
/** Notification: throttled session projection at interaction boundaries. */
export const SESSION_SNAPSHOT = 'session.snapshot';
/** Notification: hooks ask for workspace capability trust. */
export const WORKSPACE_TRUST_REQUESTED = 'workspace.trustRequested';

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

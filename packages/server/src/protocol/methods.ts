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

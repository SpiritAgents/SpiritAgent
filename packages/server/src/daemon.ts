import { randomUUID } from 'node:crypto';
import { createServer, type Server as HttpServer } from 'node:http';
import type { Socket } from 'node:net';

import { loadOrCreateToken, readCurrentToken, tokenEquals } from './auth-token.js';
import {
  registerInstance,
  unregisterInstance,
  type ServerInstanceRecord,
} from './instance-registry.js';
import {
  JSON_RPC_INTERNAL_ERROR,
  JSON_RPC_INVALID_REQUEST,
  JSON_RPC_METHOD_NOT_FOUND,
  JSON_RPC_PARSE_ERROR,
  PROTOCOL_VERSION,
  RUNTIME_EVENT,
  SERVER_CONNECTED,
  SERVER_HEALTH,
  SERVER_INITIALIZE,
  SESSION_ABORT,
  SESSION_CLOSE,
  SESSION_CREATE,
  SESSION_LIST,
  SESSION_REPLY_PENDING_APPROVAL,
  SESSION_REPLY_PENDING_QUESTIONS,
  SESSION_SET_APPROVAL_LEVEL,
  SESSION_SUBMIT_USER_TURN,
  SESSION_TURN_FINISHED,
  errorResponse,
  isJsonRpcRequest,
  notification,
  successResponse,
  type ClientKind,
  type ServerHealthResult,
  type ServerInitializeResult,
} from './protocol/index.js';
import { SessionManager } from './session-manager.js';

const SESSION_METHODS = new Set([
  SESSION_CREATE,
  SESSION_LIST,
  SESSION_CLOSE,
  SESSION_SUBMIT_USER_TURN,
  SESSION_ABORT,
  SESSION_SET_APPROVAL_LEVEL,
  SESSION_REPLY_PENDING_APPROVAL,
  SESSION_REPLY_PENDING_QUESTIONS,
]);
import {
  acceptUpgrade,
  isWebSocketUpgrade,
  rejectUpgrade,
  type WebSocketConnection,
} from './ws/websocket-server.js';

export interface DaemonOptions {
  /** Bind hostname; defaults to loopback. Pass 0.0.0.0 only for explicit remote access. */
  host?: string;
  /** 0 lets the OS pick a free port (default). */
  port?: number;
  dataDir: string;
  version: string;
  log?: (message: string) => void;
}

export interface RunningDaemon {
  readonly instanceId: string;
  readonly host: string;
  readonly port: number;
  readonly pid: number;
  readonly startedAt: string;
  readonly url: string;
  close(): Promise<void>;
}

interface ClientState {
  clientKind?: ClientKind;
  clientId?: string;
  workspaceRoot?: string;
}

function extractPresentedToken(headerValue: string | undefined, url: string | undefined): string {
  if (typeof headerValue === 'string') {
    const match = /^Bearer\s+(.+)$/i.exec(headerValue.trim());
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  if (url) {
    try {
      const parsed = new URL(url, 'http://localhost');
      return parsed.searchParams.get('token')?.trim() ?? '';
    } catch {
      return '';
    }
  }
  return '';
}

export async function startDaemon(options: DaemonOptions): Promise<RunningDaemon> {
  const host = options.host?.trim() || '127.0.0.1';
  const requestedPort = options.port ?? 0;
  const dataDir = options.dataDir;
  const version = options.version;
  const log = options.log ?? ((message: string) => console.error(message));

  // Ensure the home-level token exists before the first handshake arrives.
  await loadOrCreateToken(dataDir);

  const instanceId = randomUUID();
  const startedAt = new Date().toISOString();
  const connections = new Set<WebSocketConnection>();
  const clientStates = new Map<WebSocketConnection, ClientState>();

  const broadcast = (method: string, params: unknown): void => {
    const frame = JSON.stringify(notification(method, params));
    for (const conn of connections) {
      conn.send(frame);
    }
  };

  const sessionManager = new SessionManager(dataDir, {
    broadcastRuntimeEvent: (sessionId, event) => {
      broadcast(RUNTIME_EVENT, { sessionId, event });
    },
    broadcastTurnFinished: (sessionId, stopReason) => {
      broadcast(SESSION_TURN_FINISHED, { sessionId, stopReason });
    },
    log,
  });

  /** Params readers with strict-but-minimal validation at the RPC boundary. */
  const readSessionId = (params: Record<string, unknown>): string => {
    const sessionId = params['sessionId'];
    if (typeof sessionId !== 'string' || !sessionId.trim()) {
      throw new Error('missing sessionId');
    }
    return sessionId;
  };

  /** Session RPC surface; `conn` provides the client kind from initialize. */
  const handleSessionRpc = async (
    conn: WebSocketConnection,
    method: string,
    rawParams: unknown,
  ): Promise<unknown> => {
    const params = (rawParams ?? {}) as Record<string, unknown>;
    switch (method) {
      case SESSION_CREATE: {
        const workspaceRoot = typeof params['workspaceRoot'] === 'string' && params['workspaceRoot'].trim()
          ? params['workspaceRoot']
          : undefined;
        if (!workspaceRoot) {
          throw new Error('missing workspaceRoot');
        }
        const approvalLevel = params['approvalLevel'];
        const info = await sessionManager.createSession({
          workspaceRoot,
          hostKind: clientStates.get(conn)?.clientKind ?? 'cli',
          ...(approvalLevel === 'auto-approval' || approvalLevel === 'full-approval' || approvalLevel === 'default'
            ? { approvalLevel }
            : {}),
        });
        return info;
      }
      case SESSION_LIST:
        return { sessions: sessionManager.listSessions() };
      case SESSION_CLOSE:
        await sessionManager.closeSession(readSessionId(params));
        return { ok: true };
      case SESSION_SUBMIT_USER_TURN: {
        const text = params['text'];
        if (typeof text !== 'string') {
          throw new Error('missing text');
        }
        await sessionManager.submitUserTurn(readSessionId(params), {
          text,
          ...(Array.isArray(params['explicitImages'])
            ? { explicitImages: params['explicitImages'].filter((v): v is string => typeof v === 'string') }
            : {}),
        });
        return { accepted: true };
      }
      case SESSION_ABORT:
        sessionManager.abort(readSessionId(params));
        return { ok: true };
      case SESSION_SET_APPROVAL_LEVEL: {
        const level = params['approvalLevel'];
        if (level !== 'default' && level !== 'auto-approval' && level !== 'full-approval') {
          throw new Error('invalid approvalLevel');
        }
        await sessionManager.setApprovalLevel(readSessionId(params), level);
        return { ok: true };
      }
      case SESSION_REPLY_PENDING_APPROVAL:
        await sessionManager.replyPendingApproval(readSessionId(params), params['decision'] as never);
        return { ok: true };
      case SESSION_REPLY_PENDING_QUESTIONS:
        await sessionManager.replyPendingQuestions(readSessionId(params), params['result'] as never);
        return { ok: true };
      default:
        throw new Error(`unknown session method: ${method}`);
    }
  };

  const handleRpc = async (conn: WebSocketConnection, raw: string | Buffer): Promise<void> => {
    if (typeof raw !== 'string') {
      conn.send(JSON.stringify(errorResponse(null, JSON_RPC_INVALID_REQUEST, 'binary frames are not JSON-RPC')));
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      conn.send(JSON.stringify(errorResponse(null, JSON_RPC_PARSE_ERROR, 'parse error')));
      return;
    }
    if (!isJsonRpcRequest(parsed)) {
      conn.send(JSON.stringify(errorResponse(null, JSON_RPC_INVALID_REQUEST, 'invalid request')));
      return;
    }
    try {
      switch (parsed.method) {
        case SERVER_HEALTH: {
          const result: ServerHealthResult = {
            ok: true,
            instanceId,
            pid: process.pid,
            version,
            startedAt,
            uptimeMs: Math.round(process.uptime() * 1000),
            connections: connections.size,
          };
          conn.send(JSON.stringify(successResponse(parsed.id, result)));
          return;
        }
        case SERVER_INITIALIZE: {
          const params = (parsed.params ?? {}) as Record<string, unknown>;
          const state: ClientState = {};
          if (params['clientKind'] === 'cli' || params['clientKind'] === 'desktop' || params['clientKind'] === 'web') {
            state.clientKind = params['clientKind'];
          }
          if (typeof params['clientId'] === 'string') {
            state.clientId = params['clientId'];
          }
          if (typeof params['workspaceRoot'] === 'string') {
            state.workspaceRoot = params['workspaceRoot'];
          }
          clientStates.set(conn, state);
          const result: ServerInitializeResult = {
            protocolVersion: PROTOCOL_VERSION,
            instanceId,
            version,
            startedAt,
            dataDir,
          };
          conn.send(JSON.stringify(successResponse(parsed.id, result)));
          return;
        }
        default:
          if (SESSION_METHODS.has(parsed.method)) {
            const result = await handleSessionRpc(conn, parsed.method, parsed.params);
            conn.send(JSON.stringify(successResponse(parsed.id, result ?? null)));
            return;
          }
          conn.send(JSON.stringify(errorResponse(parsed.id, JSON_RPC_METHOD_NOT_FOUND, `unknown method: ${parsed.method}`)));
      }
    } catch (err) {
      conn.send(
        JSON.stringify(
          errorResponse(parsed.id, JSON_RPC_INTERNAL_ERROR, err instanceof Error ? err.message : String(err)),
        ),
      );
    }
  };

  const httpServer: HttpServer = createServer((req, res) => {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  httpServer.on('upgrade', (req, rawSocket, head) => {
    void head;
    // WS upgrades always ride on a net.Socket (or TLSSocket); @types/node
    // widens the event signature to Duplex.
    const socket = rawSocket as Socket;
    if (!isWebSocketUpgrade(req)) {
      rejectUpgrade(socket, 400, 'Bad Request');
      return;
    }
    void (async () => {
      const expected = await readCurrentToken(dataDir);
      const presented = extractPresentedToken(req.headers['authorization'], req.url);
      if (!expected || !tokenEquals(presented, expected)) {
        rejectUpgrade(socket, 401, 'Unauthorized');
        return;
      }
      const conn = acceptUpgrade(req, socket);
      if (!conn) {
        return;
      }
      connections.add(conn);
      conn.send(
        JSON.stringify(
          notification(SERVER_CONNECTED, {
            protocolVersion: PROTOCOL_VERSION,
            instanceId,
            version,
          }),
        ),
      );
      conn.on('message', (data: string | Buffer) => {
        void handleRpc(conn, data);
      });
      conn.on('close', () => {
        connections.delete(conn);
        clientStates.delete(conn);
      });
      conn.on('error', () => {
        connections.delete(conn);
        clientStates.delete(conn);
      });
    })();
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(requestedPort, host, () => resolve());
  });

  const address = httpServer.address();
  if (typeof address !== 'object' || address === null) {
    throw new Error('failed to resolve listening address');
  }
  const port = address.port;

  const record: ServerInstanceRecord = {
    instanceId,
    pid: process.pid,
    host,
    port,
    startedAt,
    version,
  };
  await registerInstance(dataDir, record);

  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) {
      return;
    }
    closed = true;
    sessionManager.shutdown();
    for (const conn of connections) {
      conn.close(1001, 'server shutting down');
    }
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
      httpServer.closeAllConnections();
    });
    await unregisterInstance(dataDir, instanceId);
  };

  log(`[spirit-server] listening on ws://${host}:${port} (instance ${instanceId}, pid ${process.pid})`);

  return {
    instanceId,
    host,
    port,
    pid: process.pid,
    startedAt,
    url: `ws://${host}:${port}`,
    close,
  };
}

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
  SERVER_CONNECTED,
  SERVER_HEALTH,
  SERVER_INITIALIZE,
  errorResponse,
  isJsonRpcRequest,
  notification,
  successResponse,
  type ClientKind,
  type ServerHealthResult,
  type ServerInitializeResult,
} from './protocol/index.js';
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

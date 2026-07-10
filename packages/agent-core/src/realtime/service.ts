import type { RealtimeConfig } from './types.js';
import type { RealtimeSession } from './types.js';
import type { ToolExecutor } from '../ports.js';
import { buildRealtimeSessionConfigWithTools } from './tool-definitions.js';
import { resolveRealtimeBackend } from './router.js';
import { RealtimeToolRunner } from './tool-runner.js';

export interface RealtimeToolSessionHandle {
  session: RealtimeSession;
  runner: RealtimeToolRunner;
}

export function createRealtimeSession(config: RealtimeConfig): RealtimeSession {
  const backend = resolveRealtimeBackend(config);
  const connectionKind = config.connectionKind ?? backend.connectionKind;
  if (connectionKind !== backend.connectionKind) {
    throw new Error(
      `Realtime provider ${config.providerId} does not support connection kind ${connectionKind}.`,
    );
  }
  return backend.createSession(config);
}

export function createRealtimeToolSession(
  config: RealtimeConfig,
  toolExecutor: ToolExecutor,
): RealtimeToolSessionHandle {
  const sessionConfig = buildRealtimeSessionConfigWithTools(
    config.sessionConfig ?? {},
    toolExecutor,
  );
  const session = createRealtimeSession({
    ...config,
    sessionConfig,
  });
  const runner = new RealtimeToolRunner(session, { toolExecutor });
  return { session, runner };
}

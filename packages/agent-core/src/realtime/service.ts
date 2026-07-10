import type { RealtimeConfig } from './types.js';
import type { RealtimeSession } from './types.js';
import { resolveRealtimeBackend } from './router.js';

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

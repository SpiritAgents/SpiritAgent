import type { RealtimeBackend } from '../types.js';
import type { RealtimeConfig } from '../types.js';
import type { RealtimeSession } from '../types.js';
import { GatewayRealtimeSession } from './session.js';

export class AiSdkGatewayRealtimeBackend implements RealtimeBackend {
  readonly id = 'ai-sdk-gateway-realtime';
  readonly connectionKind = 'websocket' as const;

  createSession(config: RealtimeConfig): RealtimeSession {
    return new GatewayRealtimeSession(config);
  }
}

import type { RealtimeBackend } from '../types.js';
import type { RealtimeConfig } from '../types.js';
import type { RealtimeSession } from '../types.js';
import { GatewayRealtimeSessionStub } from './session.stub.js';

export class AiSdkGatewayRealtimeBackend implements RealtimeBackend {
  readonly id = 'ai-sdk-gateway-realtime';
  readonly connectionKind = 'websocket' as const;

  createSession(config: RealtimeConfig): RealtimeSession {
    return new GatewayRealtimeSessionStub(config);
  }
}

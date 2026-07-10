import { RealtimeNotImplementedError } from '../errors.js';
import type {
  RealtimeConfig,
  RealtimeConnectionKind,
  RealtimeEvent,
  RealtimeSession,
} from '../types.js';

export class GatewayRealtimeSessionStub implements RealtimeSession {
  readonly connectionKind: RealtimeConnectionKind = 'websocket';

  constructor(private readonly config: RealtimeConfig) {}

  async connect(): Promise<void> {
    throw new RealtimeNotImplementedError(
      this.config.providerId,
      this.connectionKind,
      'Gateway realtime WebSocket session is not implemented yet.',
    );
  }

  async disconnect(): Promise<void> {}

  async sendText(): Promise<void> {
    throw new RealtimeNotImplementedError(
      this.config.providerId,
      this.connectionKind,
      'Gateway realtime WebSocket session is not implemented yet.',
    );
  }

  async sendAudio(): Promise<void> {
    throw new RealtimeNotImplementedError(
      this.config.providerId,
      this.connectionKind,
      'Gateway realtime WebSocket session is not implemented yet.',
    );
  }

  async sendImage(): Promise<void> {
    throw new RealtimeNotImplementedError(
      this.config.providerId,
      this.connectionKind,
      'Gateway realtime WebSocket session is not implemented yet.',
    );
  }

  async requestResponse(): Promise<void> {
    throw new RealtimeNotImplementedError(
      this.config.providerId,
      this.connectionKind,
      'Gateway realtime WebSocket session is not implemented yet.',
    );
  }

  async *events(): AsyncIterable<RealtimeEvent> {}
}

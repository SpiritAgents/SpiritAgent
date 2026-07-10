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
    this.throwNotImplemented();
  }

  async sendAudio(): Promise<void> {
    this.throwNotImplemented();
  }

  async sendImage(): Promise<void> {
    this.throwNotImplemented();
  }

  async requestResponse(): Promise<void> {
    this.throwNotImplemented();
  }

  async appendInputAudio(): Promise<void> {
    this.throwNotImplemented();
  }

  async commitInputAudio(): Promise<void> {
    this.throwNotImplemented();
  }

  async clearInputAudio(): Promise<void> {
    this.throwNotImplemented();
  }

  async cancelResponse(): Promise<void> {
    this.throwNotImplemented();
  }

  async submitToolResult(): Promise<void> {
    this.throwNotImplemented();
  }

  async updateSessionConfig(): Promise<void> {
    this.throwNotImplemented();
  }

  private throwNotImplemented(): never {
    throw new RealtimeNotImplementedError(
      this.config.providerId,
      this.connectionKind,
      'Gateway realtime WebSocket session is not implemented yet.',
    );
  }

  async *events(): AsyncIterable<RealtimeEvent> {}
}

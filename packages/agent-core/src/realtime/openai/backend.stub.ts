import { RealtimeNotImplementedError } from '../errors.js';
import type { RealtimeBackend } from '../types.js';
import type { RealtimeConfig } from '../types.js';
import type { RealtimeSession } from '../types.js';

class OpenAiRealtimeSessionStub implements RealtimeSession {
  readonly connectionKind = 'webrtc' as const;

  constructor(private readonly config: RealtimeConfig) {}

  async connect(): Promise<void> {
    throw new RealtimeNotImplementedError(
      this.config.providerId,
      this.connectionKind,
      'OpenAI direct realtime WebRTC backend is not implemented yet.',
    );
  }

  async disconnect(): Promise<void> {}

  async sendText(): Promise<void> {
    throw new RealtimeNotImplementedError(
      this.config.providerId,
      this.connectionKind,
      'OpenAI direct realtime WebRTC backend is not implemented yet.',
    );
  }

  async sendAudio(): Promise<void> {
    throw new RealtimeNotImplementedError(
      this.config.providerId,
      this.connectionKind,
      'OpenAI direct realtime WebRTC backend is not implemented yet.',
    );
  }

  async sendImage(): Promise<void> {
    throw new RealtimeNotImplementedError(
      this.config.providerId,
      this.connectionKind,
      'OpenAI direct realtime WebRTC backend is not implemented yet.',
    );
  }

  async requestResponse(): Promise<void> {
    throw new RealtimeNotImplementedError(
      this.config.providerId,
      this.connectionKind,
      'OpenAI direct realtime WebRTC backend is not implemented yet.',
    );
  }

  async *events(): AsyncIterable<never> {}
}

export class OpenAiRealtimeBackendStub implements RealtimeBackend {
  readonly id = 'openai-webrtc-stub';
  readonly connectionKind = 'webrtc' as const;

  createSession(config: RealtimeConfig): RealtimeSession {
    return new OpenAiRealtimeSessionStub(config);
  }
}

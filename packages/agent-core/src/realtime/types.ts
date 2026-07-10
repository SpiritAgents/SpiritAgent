export type RealtimeConnectionKind = 'websocket' | 'webrtc';

export type RealtimeProviderId = 'vercel-ai-gateway' | 'openai';

export interface RealtimeAudioFormatConfig {
  type: string;
  rate?: number;
}

export interface RealtimeTranscriptionConfig {
  model?: string;
  language?: string;
  prompt?: string;
}

export interface RealtimeTurnDetectionConfig {
  type: 'server-vad' | 'semantic-vad' | 'disabled';
  threshold?: number;
  silenceDurationMs?: number;
  prefixPaddingMs?: number;
}

export interface RealtimeSessionConfig {
  instructions?: string;
  voice?: string;
  outputModalities?: Array<'text' | 'audio'>;
  inputAudioFormat?: RealtimeAudioFormatConfig;
  outputAudioFormat?: RealtimeAudioFormatConfig;
  inputAudioTranscription?: boolean | RealtimeTranscriptionConfig;
  outputAudioTranscription?: boolean | RealtimeTranscriptionConfig;
  turnDetection?: RealtimeTurnDetectionConfig | null;
  providerOptions?: Record<string, unknown>;
}

export interface RealtimeConfig {
  providerId: RealtimeProviderId;
  model: string;
  apiKey: string;
  baseUrl?: string;
  connectionKind?: RealtimeConnectionKind;
  sessionConfig?: RealtimeSessionConfig;
}

export interface RealtimeEventBase {
  raw?: unknown;
}

export type RealtimeEvent =
  | (RealtimeEventBase & { type: 'session-created'; sessionId?: string })
  | (RealtimeEventBase & { type: 'session-updated' })
  | (RealtimeEventBase & { type: 'speech-started'; itemId?: string })
  | (RealtimeEventBase & { type: 'speech-stopped'; itemId?: string })
  | (RealtimeEventBase & { type: 'audio-committed'; itemId?: string; previousItemId?: string })
  | (RealtimeEventBase & { type: 'conversation-item-added'; itemId: string; item: unknown })
  | (RealtimeEventBase & { type: 'input-transcription-completed'; itemId: string; transcript: string })
  | (RealtimeEventBase & { type: 'response-created'; responseId: string })
  | (RealtimeEventBase & { type: 'response-done'; responseId: string; status: string })
  | (RealtimeEventBase & { type: 'output-item-added'; responseId: string; itemId: string })
  | (RealtimeEventBase & { type: 'output-item-done'; responseId: string; itemId: string })
  | (RealtimeEventBase & { type: 'content-part-added'; responseId: string; itemId: string })
  | (RealtimeEventBase & { type: 'content-part-done'; responseId: string; itemId: string })
  | (RealtimeEventBase & { type: 'text-delta'; responseId: string; itemId: string; text: string })
  | (RealtimeEventBase & { type: 'text-done'; responseId: string; itemId: string; text?: string })
  | (RealtimeEventBase & { type: 'audio-delta'; responseId: string; itemId: string; data: Uint8Array })
  | (RealtimeEventBase & { type: 'audio-done'; responseId: string; itemId: string })
  | (RealtimeEventBase & {
    type: 'audio-transcript-delta';
    responseId: string;
    itemId: string;
    text: string;
  })
  | (RealtimeEventBase & {
    type: 'audio-transcript-done';
    responseId: string;
    itemId: string;
    transcript?: string;
  })
  | (RealtimeEventBase & {
    type: 'function-call-arguments-delta';
    responseId: string;
    itemId: string;
    callId: string;
    delta: string;
  })
  | (RealtimeEventBase & {
    type: 'function-call-arguments-done';
    responseId: string;
    itemId: string;
    callId: string;
    name: string;
    argumentsJson: string;
  })
  | (RealtimeEventBase & { type: 'error'; message: string; code?: string })
  | (RealtimeEventBase & { type: 'custom'; rawType: string })
  | (RealtimeEventBase & { type: 'disconnected' });

export interface RealtimeSession {
  readonly connectionKind: RealtimeConnectionKind;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendText(text: string): Promise<void>;
  sendAudio(audio: Uint8Array, mimeType?: string): Promise<void>;
  sendImage(data: Uint8Array, mimeType: string): Promise<void>;
  requestResponse(): Promise<void>;
  events(): AsyncIterable<RealtimeEvent>;
}

export interface RealtimeBackend {
  readonly id: string;
  readonly connectionKind: RealtimeConnectionKind;
  createSession(config: RealtimeConfig): RealtimeSession;
}

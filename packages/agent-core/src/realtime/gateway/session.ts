import { createGateway, type GatewayRealtimeModelId } from '@ai-sdk/gateway';
import type { Experimental_RealtimeModelV4 } from '@ai-sdk/provider';

import { RealtimeCapabilityError } from '../errors.js';
import { mapSdkRealtimeServerEvents, toSdkRealtimeSessionConfig } from '../events.js';
import { normalizeGatewayServerEvent } from './wire-events.js';
import { getLlmFetch } from '../../llm-fetch.js';
import type {
  RealtimeConfig,
  RealtimeConnectionKind,
  RealtimeEvent,
  RealtimeSession,
} from '../types.js';

const AUDIO_CHUNK_BYTES = 4096;

function toBase64(data: Uint8Array): string {
  return Buffer.from(data).toString('base64');
}

function extractPcmPayload(audio: Uint8Array, mimeType?: string): Uint8Array {
  const normalizedMime = mimeType?.trim().toLowerCase() ?? '';
  if (!normalizedMime.includes('wav') && audio[0] !== 0x52) {
    return audio;
  }

  const buffer = Buffer.from(audio);
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF') {
    return audio;
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    if (chunkId === 'data') {
      return buffer.subarray(dataOffset, dataOffset + chunkSize);
    }
    offset = dataOffset + chunkSize + (chunkSize % 2);
  }

  return audio;
}

export class GatewayRealtimeSession implements RealtimeSession {
  readonly connectionKind: RealtimeConnectionKind = 'websocket';

  private ws: WebSocket | null = null;
  private codec: Experimental_RealtimeModelV4 | null = null;
  private connected = false;
  private closed = false;
  private readonly eventQueue: RealtimeEvent[] = [];
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly config: RealtimeConfig) {}

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    const provider = createGateway({
      apiKey: this.config.apiKey,
      fetch: getLlmFetch(),
    });
    const sessionConfig = toSdkRealtimeSessionConfig(this.config.sessionConfig);
    const { token, url } = await provider.experimental_realtime.getToken({
      model: this.config.model as GatewayRealtimeModelId,
      ...(sessionConfig ? { sessionConfig: sessionConfig as never } : {}),
    });

    this.codec = provider.experimental_realtime(this.config.model as GatewayRealtimeModelId);
    const wsConfig = this.codec.getWebSocketConfig({ token, url });

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(wsConfig.url, wsConfig.protocols);
      this.ws = ws;

      ws.addEventListener('open', () => {
        this.connected = true;
        resolve();
      });
      ws.addEventListener('error', () => {
        reject(new Error('Gateway realtime WebSocket connection failed.'));
      });
      ws.addEventListener('message', (event) => {
        this.handleMessage(event);
      });
      ws.addEventListener('close', () => {
        this.handleClose();
      });
    });

    if (this.config.sessionConfig) {
      await this.sendClientEvent({
        type: 'session-update',
        config: toSdkRealtimeSessionConfig(this.config.sessionConfig) as never,
      });
    }
  }

  async disconnect(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.connected = false;
    this.ws?.close();
    this.ws = null;
    this.enqueue({ type: 'disconnected' });
  }

  async sendText(text: string): Promise<void> {
    this.assertConnected();
    await this.sendClientEvent({
      type: 'conversation-item-create',
      item: {
        type: 'text-message',
        role: 'user',
        text,
      },
    });
  }

  async sendAudio(audio: Uint8Array, mimeType?: string): Promise<void> {
    this.assertConnected();
    const pcm = extractPcmPayload(audio, mimeType);
    const chunkSize = AUDIO_CHUNK_BYTES;
    for (let offset = 0; offset < pcm.length; offset += chunkSize) {
      const chunk = pcm.subarray(offset, offset + chunkSize);
      await this.sendClientEvent({
        type: 'input-audio-append',
        audio: toBase64(chunk),
      });
    }
    await this.sendClientEvent({ type: 'input-audio-commit' });
  }

  async sendImage(_data: Uint8Array, _mimeType: string): Promise<void> {
    throw new RealtimeCapabilityError(
      this.config.providerId,
      'image-input',
      'vercel-ai-gateway realtime does not support image input.',
    );
  }

  async requestResponse(): Promise<void> {
    this.assertConnected();
    await this.sendClientEvent({ type: 'response-create' });
  }

  async *events(): AsyncIterable<RealtimeEvent> {
    while (!this.closed || this.eventQueue.length > 0) {
      const next = this.eventQueue.shift();
      if (next) {
        yield next;
        continue;
      }

      if (this.closed) {
        return;
      }

      await new Promise<void>((resolve) => {
        this.waiters.push(resolve);
      });
    }
  }

  private assertConnected(): void {
    if (!this.connected || !this.codec || !this.ws) {
      throw new Error('Gateway realtime session is not connected.');
    }
  }

  private async sendClientEvent(event: Parameters<Experimental_RealtimeModelV4['serializeClientEvent']>[0]) {
    this.assertConnected();
    const payload = await this.codec!.serializeClientEvent(event);
    this.ws!.send(JSON.stringify(payload));
  }

  private handleMessage(event: MessageEvent): void {
    if (!this.codec) {
      return;
    }

    try {
      const raw = typeof event.data === 'string'
        ? JSON.parse(event.data)
        : JSON.parse(Buffer.from(event.data as ArrayBuffer).toString('utf8'));
      const healthCheck = this.codec.getHealthCheckResponse?.(raw);
      if (healthCheck) {
        this.ws?.send(JSON.stringify(healthCheck));
      }
      const parsed = normalizeGatewayServerEvent(this.codec.parseServerEvent(raw));
      const mapped = mapSdkRealtimeServerEvents(parsed);
      for (const item of mapped) {
        this.enqueue(item);
      }
    } catch (error) {
      this.enqueue({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private handleClose(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.connected = false;
    this.enqueue({ type: 'disconnected' });
  }

  private enqueue(event: RealtimeEvent): void {
    this.eventQueue.push(event);
    const waiters = this.waiters.splice(0, this.waiters.length);
    for (const resolve of waiters) {
      resolve();
    }
  }
}

import { createGateway, type GatewayRealtimeModelId } from '@ai-sdk/gateway';
import type { Experimental_RealtimeModelV4 } from '@ai-sdk/provider';

import { RealtimeCapabilityError } from '../errors.js';
import { mapSdkRealtimeServerEvents, serializeRealtimeToolResultOutput, toSdkRealtimeSessionConfig } from '../events.js';
import { normalizeGatewayServerEvent } from './wire-events.js';
import { getLlmFetch } from '../../llm-fetch.js';
import type {
  RealtimeConfig,
  RealtimeConnectionKind,
  RealtimeEvent,
  RealtimeSession,
  RealtimeSessionConfig,
  RealtimeSubmitToolResultInput,
} from '../types.js';

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
  private connectTask: Promise<void> | null = null;
  private readonly eventQueue: RealtimeEvent[] = [];
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly config: RealtimeConfig) {}

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }
    if (!this.connectTask) {
      this.connectTask = this.performConnect().finally(() => {
        this.connectTask = null;
      });
    }
    return this.connectTask;
  }

  private async performConnect(): Promise<void> {
    this.closed = false;
    this.eventQueue.length = 0;

    const provider = createGateway({
      apiKey: this.config.apiKey,
      fetch: getLlmFetch(),
    });
    const sessionConfig = toSdkRealtimeSessionConfig(this.config.sessionConfig);
    const { token, url } = await provider.experimental_realtime.getToken({
      model: this.config.model as GatewayRealtimeModelId,
      ...(sessionConfig ? { sessionConfig: sessionConfig as never } : {}),
    });
    this.ensureConnectNotAborted();

    this.codec = provider.experimental_realtime(this.config.model as GatewayRealtimeModelId);
    const wsConfig = this.codec.getWebSocketConfig({ token, url });
    this.ensureConnectNotAborted();

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const ws = new WebSocket(wsConfig.url, wsConfig.protocols);
      this.ws = ws;

      const settle = (callback: () => void): void => {
        if (settled) {
          return;
        }
        settled = true;
        callback();
      };

      ws.addEventListener('open', () => {
        if (this.ws !== ws) {
          ws.close();
          return;
        }
        if (this.closed) {
          ws.close();
          this.ws = null;
          settle(() => {
            reject(new Error('Gateway realtime connect aborted because the session was disconnected.'));
          });
          return;
        }
        this.connected = true;
        settle(resolve);
      });
      ws.addEventListener('error', () => {
        if (this.ws !== ws) {
          return;
        }
        this.connected = false;
        this.ws = null;
        settle(() => {
          reject(new Error('Gateway realtime WebSocket connection failed.'));
        });
      });
      ws.addEventListener('message', (event) => {
        if (this.ws !== ws) {
          return;
        }
        this.handleMessage(event);
      });
      ws.addEventListener('close', () => {
        if (this.ws !== ws) {
          return;
        }
        if (!settled) {
          this.connected = false;
          this.ws = null;
          settle(() => {
            reject(new Error('Gateway realtime WebSocket closed before connection opened.'));
          });
          return;
        }
        this.handleClose();
      });
    });

    this.ensureConnectNotAborted();

    if (this.config.sessionConfig?.tools && this.config.sessionConfig.tools.length > 0) {
      await this.updateSessionConfig(this.config.sessionConfig);
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
    if (pcm.length === 0) {
      throw new Error('Gateway realtime audio input is empty after PCM extraction.');
    }

    await this.sendClientEvent({
      type: 'conversation-item-create',
      item: {
        type: 'audio-message',
        role: 'user',
        audio: toBase64(pcm),
      },
    });
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

  async appendInputAudio(chunk: Uint8Array): Promise<void> {
    this.assertConnected();
    if (chunk.length === 0) {
      throw new Error('Gateway realtime appendInputAudio chunk is empty.');
    }

    await this.sendClientEvent({
      type: 'input-audio-append',
      audio: toBase64(chunk),
    });
  }

  async commitInputAudio(): Promise<void> {
    this.assertConnected();
    await this.sendClientEvent({ type: 'input-audio-commit' });
  }

  async clearInputAudio(): Promise<void> {
    this.assertConnected();
    await this.sendClientEvent({ type: 'input-audio-clear' });
  }

  async cancelResponse(): Promise<void> {
    this.assertConnected();
    await this.sendClientEvent({ type: 'response-cancel' });
  }

  async submitToolResult(input: RealtimeSubmitToolResultInput): Promise<void> {
    this.assertConnected();
    await this.sendClientEvent({
      type: 'conversation-item-create',
      item: {
        type: 'function-call-output',
        callId: input.callId,
        output: serializeRealtimeToolResultOutput(input.output),
        ...(input.name ? { name: input.name } : {}),
      },
    });
  }

  async updateSessionConfig(config: RealtimeSessionConfig): Promise<void> {
    this.assertConnected();
    const sdkConfig = toSdkRealtimeSessionConfig(config);
    if (!sdkConfig) {
      throw new Error('Gateway realtime updateSessionConfig requires a non-empty session config.');
    }
    await this.sendClientEvent({
      type: 'session-update',
      config: sdkConfig as never,
    });
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

  private ensureConnectNotAborted(): void {
    if (this.closed) {
      throw new Error('Gateway realtime connect aborted because the session was disconnected.');
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

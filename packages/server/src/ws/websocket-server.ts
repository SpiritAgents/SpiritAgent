/**
 * Minimal RFC 6455 WebSocket server over node:http — no third-party deps.
 *
 * Supports: text/binary messages with fragmentation, ping/pong, close
 * handshake, masked client frames (required), 16/64-bit extended lengths.
 * Server frames are never masked, per spec.
 */

import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export const OPCODE_CONTINUATION = 0x0;
export const OPCODE_TEXT = 0x1;
export const OPCODE_BINARY = 0x2;
export const OPCODE_CLOSE = 0x8;
export const OPCODE_PING = 0x9;
export const OPCODE_PONG = 0xa;

/** Reject frames advertising a payload larger than this (before inflation). */
export const MAX_FRAME_PAYLOAD_BYTES = 64 * 1024 * 1024;

export function computeAcceptKey(secWebSocketKey: string): string {
  return createHash('sha1')
    .update(secWebSocketKey + WS_GUID)
    .digest('base64');
}

export function encodeFrame(opcode: number, payload: Buffer, fin = true): Buffer {
  const length = payload.length;
  let header: Buffer;
  const firstByte = (fin ? 0x80 : 0x00) | (opcode & 0x0f);
  if (length < 126) {
    header = Buffer.from([firstByte, length]);
  } else if (length <= 0xffff) {
    header = Buffer.alloc(4);
    header[0] = firstByte;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = firstByte;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  return Buffer.concat([header, payload]);
}

export interface DecodedFrame {
  fin: boolean;
  opcode: number;
  payload: Buffer;
}

/**
 * Incremental frame parser. Feed arbitrary socket chunks; complete frames
 * come out of `feed`. Protocol violations throw `WebSocketProtocolError`.
 */
export class WebSocketFrameParser {
  private buffer: Buffer = Buffer.alloc(0);

  feed(chunk: Buffer): DecodedFrame[] {
    this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);
    const frames: DecodedFrame[] = [];
    for (;;) {
      const frame = this.tryParseFrame();
      if (!frame) {
        return frames;
      }
      frames.push(frame);
    }
  }

  private tryParseFrame(): DecodedFrame | null {
    const buf = this.buffer;
    if (buf.length < 2) {
      return null;
    }
    const first = buf[0]!;
    const second = buf[1]!;
    const fin = (first & 0x80) !== 0;
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    let offset = 2;

    if (length === 126) {
      if (buf.length < offset + 2) {
        return null;
      }
      length = buf.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (buf.length < offset + 8) {
        return null;
      }
      const bigLength = buf.readBigUInt64BE(offset);
      if (bigLength > BigInt(MAX_FRAME_PAYLOAD_BYTES)) {
        throw new WebSocketProtocolError(1009, 'frame too large');
      }
      length = Number(bigLength);
      offset += 8;
    }
    if (length > MAX_FRAME_PAYLOAD_BYTES) {
      throw new WebSocketProtocolError(1009, 'frame too large');
    }

    let maskingKey: Buffer | null = null;
    if (masked) {
      if (buf.length < offset + 4) {
        return null;
      }
      maskingKey = buf.subarray(offset, offset + 4);
      offset += 4;
    }

    if (buf.length < offset + length) {
      return null;
    }
    let payload = buf.subarray(offset, offset + length);
    if (maskingKey) {
      const unmasked = Buffer.allocUnsafe(length);
      for (let i = 0; i < length; i += 1) {
        unmasked[i] = payload[i]! ^ maskingKey[i % 4]!;
      }
      payload = unmasked;
    }
    this.buffer = buf.subarray(offset + length);
    return { fin, opcode, payload };
  }
}

export class WebSocketProtocolError extends Error {
  constructor(
    public readonly closeCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'WebSocketProtocolError';
  }
}

export interface WebSocketConnectionEvents {
  message: (data: string | Buffer) => void;
  close: (code: number, reason: string) => void;
  error: (err: Error) => void;
}

/**
 * One upgraded WebSocket connection. Text messages arrive as strings;
 * binary as Buffers. Fragmented messages are reassembled.
 */
export class WebSocketConnection extends EventEmitter {
  private readonly parser = new WebSocketFrameParser();
  private fragmentOpcode: number | null = null;
  private fragments: Buffer[] = [];
  private closeSent = false;
  private closed = false;

  constructor(private readonly socket: Socket) {
    super();
    socket.on('data', (chunk: Buffer) => this.handleData(chunk));
    socket.on('error', (err: Error) => this.emit('error', err));
    socket.on('close', () => {
      if (!this.closed) {
        this.closed = true;
        this.emit('close', 1006, 'abnormal closure');
      }
    });
  }

  send(text: string): void {
    if (this.closed) {
      return;
    }
    this.socket.write(encodeFrame(OPCODE_TEXT, Buffer.from(text, 'utf8')));
  }

  ping(payload: Buffer = Buffer.alloc(0)): void {
    if (this.closed) {
      return;
    }
    this.socket.write(encodeFrame(OPCODE_PING, payload));
  }

  close(code = 1000, reason = ''): void {
    if (this.closed) {
      return;
    }
    if (!this.closeSent) {
      this.closeSent = true;
      const reasonBuffer = Buffer.from(reason, 'utf8');
      const payload = Buffer.alloc(2 + reasonBuffer.length);
      payload.writeUInt16BE(code, 0);
      reasonBuffer.copy(payload, 2);
      this.socket.write(encodeFrame(OPCODE_CLOSE, payload));
    }
    this.socket.end();
  }

  private handleData(chunk: Buffer): void {
    let frames: DecodedFrame[];
    try {
      frames = this.parser.feed(chunk);
    } catch (err) {
      if (err instanceof WebSocketProtocolError) {
        this.close(err.closeCode, err.message);
        return;
      }
      throw err;
    }
    for (const frame of frames) {
      this.handleFrame(frame);
      if (this.closed) {
        return;
      }
    }
  }

  private handleFrame(frame: DecodedFrame): void {
    switch (frame.opcode) {
      case OPCODE_TEXT:
      case OPCODE_BINARY:
        if (this.fragmentOpcode !== null) {
          this.close(1002, 'new message before finishing continuation');
          return;
        }
        if (frame.fin) {
          this.emitMessage(frame.opcode, frame.payload);
        } else {
          this.fragmentOpcode = frame.opcode;
          this.fragments = [frame.payload];
        }
        return;
      case OPCODE_CONTINUATION: {
        if (this.fragmentOpcode === null) {
          this.close(1002, 'unexpected continuation frame');
          return;
        }
        this.fragments.push(frame.payload);
        if (frame.fin) {
          const opcode = this.fragmentOpcode;
          const payload = Buffer.concat(this.fragments);
          this.fragmentOpcode = null;
          this.fragments = [];
          this.emitMessage(opcode, payload);
        }
        return;
      }
      case OPCODE_PING:
        if (!this.closed) {
          this.socket.write(encodeFrame(OPCODE_PONG, frame.payload));
        }
        return;
      case OPCODE_PONG:
        return;
      case OPCODE_CLOSE: {
        const code = frame.payload.length >= 2 ? frame.payload.readUInt16BE(0) : 1000;
        const reason =
          frame.payload.length > 2 ? frame.payload.subarray(2).toString('utf8') : '';
        if (!this.closeSent) {
          this.closeSent = true;
          this.socket.write(encodeFrame(OPCODE_CLOSE, frame.payload));
        }
        this.closed = true;
        this.socket.end();
        this.emit('close', code, reason);
        return;
      }
      default:
        this.close(1002, `unsupported opcode ${frame.opcode}`);
    }
  }

  private emitMessage(opcode: number, payload: Buffer): void {
    if (opcode === OPCODE_TEXT) {
      this.emit('message', payload.toString('utf8'));
    } else {
      this.emit('message', payload);
    }
  }
}

export function isWebSocketUpgrade(req: IncomingMessage): boolean {
  const upgrade = req.headers['upgrade'];
  return typeof upgrade === 'string' && upgrade.toLowerCase() === 'websocket';
}

/**
 * Completes the RFC 6455 opening handshake on an `upgrade` request.
 * Returns null (after writing a 400 response) when headers are invalid.
 */
export function acceptUpgrade(req: IncomingMessage, socket: Socket): WebSocketConnection | null {
  const key = req.headers['sec-websocket-key'];
  if (typeof key !== 'string' || key.length === 0) {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
    return null;
  }
  const accept = computeAcceptKey(key);
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n` +
      '\r\n',
  );
  return new WebSocketConnection(socket);
}

export function rejectUpgrade(socket: Socket, status: number, statusText: string): void {
  socket.write(`HTTP/1.1 ${status} ${statusText}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

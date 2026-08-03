import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MAX_FRAME_PAYLOAD_BYTES,
  OPCODE_BINARY,
  OPCODE_CLOSE,
  OPCODE_PING,
  OPCODE_TEXT,
  WebSocketFrameParser,
  WebSocketProtocolError,
  computeAcceptKey,
  encodeFrame,
} from '../src/ws/websocket-server.js';

function maskFrame(frame: Buffer, maskingKey: Buffer): Buffer {
  // Re-encode a client-style masked frame: header + mask bit + key + masked payload.
  const first = frame[0]!;
  const payloadLength = frame.length - 2; // only valid for small payloads in these tests
  const header = Buffer.from([first, 0x80 | payloadLength]);
  const payload = frame.subarray(2);
  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i += 1) {
    masked[i] = payload[i]! ^ maskingKey[i % 4]!;
  }
  return Buffer.concat([header, maskingKey, masked]);
}

describe('computeAcceptKey', () => {
  it('matches the RFC 6455 example', () => {
    assert.equal(
      computeAcceptKey('dGhlIHNhbXBsZSBub25jZQ=='),
      's3pPLMBiTxaQ9kYGzzhZRbK+xOo=',
    );
  });
});

describe('encodeFrame', () => {
  it('encodes small payloads with a 2-byte header', () => {
    const frame = encodeFrame(OPCODE_TEXT, Buffer.from('hi'));
    assert.equal(frame[0], 0x80 | OPCODE_TEXT);
    assert.equal(frame[1], 2);
    assert.equal(frame.subarray(2).toString(), 'hi');
  });

  it('encodes 16-bit extended lengths', () => {
    const payload = Buffer.alloc(300, 0x61);
    const frame = encodeFrame(OPCODE_TEXT, payload);
    assert.equal(frame[1], 126);
    assert.equal(frame.readUInt16BE(2), 300);
    assert.equal(frame.length, 4 + 300);
  });

  it('encodes 64-bit extended lengths', () => {
    const payload = Buffer.alloc(70_000, 0x62);
    const frame = encodeFrame(OPCODE_BINARY, payload);
    assert.equal(frame[1], 127);
    assert.equal(frame.readBigUInt64BE(2), 70_000n);
    assert.equal(frame.length, 10 + 70_000);
  });

  it('marks non-final fragments', () => {
    const frame = encodeFrame(OPCODE_TEXT, Buffer.from('x'), false);
    assert.equal(frame[0]! & 0x80, 0);
  });
});

describe('WebSocketFrameParser', () => {
  it('parses a masked client text frame', () => {
    const parser = new WebSocketFrameParser();
    const wire = maskFrame(encodeFrame(OPCODE_TEXT, Buffer.from('hello')), Buffer.from([1, 2, 3, 4]));
    const frames = parser.feed(wire);
    assert.equal(frames.length, 1);
    assert.equal(frames[0]!.opcode, OPCODE_TEXT);
    assert.equal(frames[0]!.fin, true);
    assert.equal(frames[0]!.payload.toString(), 'hello');
  });

  it('waits for more bytes on partial frames', () => {
    const parser = new WebSocketFrameParser();
    const wire = maskFrame(encodeFrame(OPCODE_TEXT, Buffer.from('hello')), Buffer.from([9, 9, 9, 9]));
    assert.deepEqual(parser.feed(wire.subarray(0, 3)), []);
    const frames = parser.feed(wire.subarray(3));
    assert.equal(frames.length, 1);
    assert.equal(frames[0]!.payload.toString(), 'hello');
  });

  it('parses multiple frames from one chunk', () => {
    const parser = new WebSocketFrameParser();
    const a = maskFrame(encodeFrame(OPCODE_TEXT, Buffer.from('a')), Buffer.from([1, 1, 1, 1]));
    const b = maskFrame(encodeFrame(OPCODE_PING, Buffer.from('b')), Buffer.from([2, 2, 2, 2]));
    const frames = parser.feed(Buffer.concat([a, b]));
    assert.equal(frames.length, 2);
    assert.equal(frames[0]!.opcode, OPCODE_TEXT);
    assert.equal(frames[1]!.opcode, OPCODE_PING);
  });

  it('rejects frames beyond the size cap', () => {
    const parser = new WebSocketFrameParser();
    const header = Buffer.alloc(10);
    header[0] = 0x80 | OPCODE_BINARY;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(MAX_FRAME_PAYLOAD_BYTES + 1), 2);
    assert.throws(() => parser.feed(header), WebSocketProtocolError);
  });

  it('parses close frames', () => {
    const parser = new WebSocketFrameParser();
    const payload = Buffer.alloc(2);
    payload.writeUInt16BE(1000, 0);
    const wire = maskFrame(encodeFrame(OPCODE_CLOSE, payload), Buffer.from([5, 5, 5, 5]));
    const frames = parser.feed(wire);
    assert.equal(frames.length, 1);
    assert.equal(frames[0]!.opcode, OPCODE_CLOSE);
    assert.equal(frames[0]!.payload.readUInt16BE(0), 1000);
  });
});

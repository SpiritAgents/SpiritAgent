import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createRealtimeSession } from '../../realtime/service.js';
import type { RealtimeEvent, RealtimeSession } from '../../realtime/types.js';
import { printSmokeSection } from '../shared/print.js';
import { shouldRunLiveSmoke } from './env.js';

const MODEL_ID = 'openai/gpt-realtime-2';
const LONG_READ_PROMPT = [
  'Read the following passage aloud in a calm voice.',
  'Do not summarize. Read every sentence fully.',
  'Passage: The old lighthouse stood on the cliff for centuries,',
  'watching ships pass through fog and storm.',
  'Sailors trusted its beam as they navigated rocky shores.',
  'Each night the keeper climbed the spiral stairs,',
  'lit the lamp, and listened to the sea.',
  'Generations came and went, but the light endured.',
  'When storms rose, waves crashed against the rocks below,',
  'yet the tower held firm against wind and rain.',
  'Children in the village below told stories of the beacon,',
  'imagining it could speak in flashes of gold and white.',
].join(' ');
const LIVE_FIXTURES_DIR = path.join(process.cwd(), 'src/smoke/live/fixtures');
const INTERRUPT_FIXTURE_PATH = path.join(LIVE_FIXTURES_DIR, 'interrupt-speech.wav');
const PCM_CHUNK_BYTES = 4800;

function loadGatewayKeyFromEnv(): string | undefined {
  const apiKey = process.env.SPIRIT_API_KEY?.trim()
    || process.env.OPENAI_API_KEY?.trim();
  return apiKey && apiKey.length > 0 ? apiKey : undefined;
}

function extractPcmPayload(audio: Uint8Array): Uint8Array {
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

async function streamPcmChunks(
  session: RealtimeSession,
  pcm: Uint8Array,
  chunkSize: number = PCM_CHUNK_BYTES,
): Promise<void> {
  for (let offset = 0; offset < pcm.length; offset += chunkSize) {
    const chunk = pcm.subarray(offset, Math.min(offset + chunkSize, pcm.length));
    await session.appendInputAudio(chunk);
  }
}

function summarizeEvents(events: readonly RealtimeEvent[]) {
  return {
    eventTypes: events.map((event) => event.type),
    audioChunkCount: events.filter((event) => event.type === 'audio-delta').length,
    responseDoneStatuses: events
      .filter((event) => event.type === 'response-done')
      .map((event) => event.status),
    hasSpeechStarted: events.some((event) => event.type === 'speech-started'),
    responseCreatedCount: events.filter((event) => event.type === 'response-created').length,
  };
}

async function runExplicitCancelCase(apiKey: string): Promise<void> {
  const session = createRealtimeSession({
    providerId: 'vercel-ai-gateway',
    model: MODEL_ID,
    apiKey,
    sessionConfig: {
      instructions: 'You are a voice assistant for smoke testing.',
      outputModalities: ['audio'],
      turnDetection: { type: 'disabled' },
      voice: 'alloy',
      inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
      outputAudioFormat: { type: 'audio/pcm', rate: 24000 },
    },
  });

  const events: RealtimeEvent[] = [];
  let cancelSent = false;
  let audioChunksAfterCancel = 0;

  await session.connect();
  const timeout = setTimeout(() => {
    void session.disconnect();
  }, 90_000);

  try {
    await session.sendText(LONG_READ_PROMPT);
    await session.requestResponse();

    for await (const event of session.events()) {
      events.push(event);

      if (event.type === 'audio-delta') {
        if (!cancelSent) {
          cancelSent = true;
          await session.cancelResponse();
        } else {
          audioChunksAfterCancel += 1;
        }
      }

      if (cancelSent && event.type === 'response-done') {
        break;
      }
      if (event.type === 'error' || event.type === 'disconnected') {
        break;
      }
    }
  } finally {
    clearTimeout(timeout);
    await session.disconnect();
  }

  const summary = summarizeEvents(events);
  printSmokeSection('realtime gateway interrupt live explicit cancel', summary);

  const cancelled = events.some(
    (event) => event.type === 'response-done' && event.status === 'cancelled',
  );

  if (!cancelSent) {
    throw new Error('realtime gateway interrupt live smoke Case A 未收到 audio-delta。');
  }
  if (!cancelled && audioChunksAfterCancel > 2) {
    throw new Error(
      `realtime gateway interrupt live smoke Case A 未观察到 cancelled 或打断后仍持续输出音频: ${JSON.stringify(summary)}`,
    );
  }
}

async function runVadBargeInCase(apiKey: string): Promise<void> {
  const interruptFixture = extractPcmPayload(
    Uint8Array.from(await readFile(INTERRUPT_FIXTURE_PATH)),
  );
  if (interruptFixture.length === 0) {
    throw new Error('realtime gateway interrupt live smoke Case B interrupt fixture PCM 为空。');
  }

  const session = createRealtimeSession({
    providerId: 'vercel-ai-gateway',
    model: MODEL_ID,
    apiKey,
    sessionConfig: {
      instructions: 'You are a voice assistant for smoke testing.',
      outputModalities: ['audio'],
      turnDetection: {
        type: 'server-vad',
        createResponse: true,
        interruptResponse: true,
      },
      voice: 'alloy',
      inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
      outputAudioFormat: { type: 'audio/pcm', rate: 24000 },
    },
  });

  const events: RealtimeEvent[] = [];
  let interruptStreamStarted = false;

  await session.connect();
  const timeout = setTimeout(() => {
    void session.disconnect();
  }, 90_000);

  try {
    await session.sendText(LONG_READ_PROMPT);
    await session.requestResponse();

    for await (const event of session.events()) {
      events.push(event);

      if (event.type === 'audio-delta' && !interruptStreamStarted) {
        interruptStreamStarted = true;
        void streamPcmChunks(session, interruptFixture);
      }

      const hasSpeechStarted = events.some((item) => item.type === 'speech-started');
      const hasCancelled = events.some(
        (item) => item.type === 'response-done' && item.status === 'cancelled',
      );
      const responseCreatedCount = events.filter((item) => item.type === 'response-created').length;
      if (interruptStreamStarted && hasSpeechStarted && (hasCancelled || responseCreatedCount >= 2)) {
        break;
      }

      if (event.type === 'error' || event.type === 'disconnected') {
        break;
      }
    }
  } finally {
    clearTimeout(timeout);
    await session.disconnect();
  }

  const summary = summarizeEvents(events);
  printSmokeSection('realtime gateway interrupt live vad barge-in', {
    ...summary,
    interruptFixturePath: INTERRUPT_FIXTURE_PATH,
  });

  if (!interruptStreamStarted) {
    throw new Error('realtime gateway interrupt live smoke Case B 未收到 audio-delta。');
  }

  const hasSpeechStarted = events.some((event) => event.type === 'speech-started');
  const hasCancelled = events.some(
    (event) => event.type === 'response-done' && event.status === 'cancelled',
  );
  const hasNewResponse = events.filter((event) => event.type === 'response-created').length >= 2;

  if (!hasSpeechStarted) {
    throw new Error(
      `realtime gateway interrupt live smoke Case B 未收到 speech-started: ${JSON.stringify(summary)}`,
    );
  }
  if (!hasCancelled && !hasNewResponse) {
    throw new Error(
      `realtime gateway interrupt live smoke Case B 未观察到 cancelled 或新 response-created: ${JSON.stringify(summary)}`,
    );
  }
}

async function main(): Promise<void> {
  if (!shouldRunLiveSmoke()) {
    return;
  }

  const apiKey = loadGatewayKeyFromEnv();
  if (!apiKey) {
    throw new Error(
      'realtime gateway interrupt live smoke 需要设置 SPIRIT_API_KEY 或 OPENAI_API_KEY 环境变量。',
    );
  }

  await runExplicitCancelCase(apiKey);
  await runVadBargeInCase(apiKey);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`realtime gateway interrupt live smoke failed: ${message}`);
  process.exitCode = 1;
});

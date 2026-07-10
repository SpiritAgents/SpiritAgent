import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createRealtimeSession } from '../../realtime/service.js';
import type { RealtimeEvent } from '../../realtime/types.js';
import { printSmokeSection } from '../shared/print.js';
import { shouldRunLiveSmoke } from './env.js';

const MODEL_ID = 'openai/gpt-realtime-2';
const TEXT_PROMPT = 'Reply with exactly REALTIME_TEXT_OK.';
const AUDIO_PROMPT = 'The user said REALTIME_AUDIO_OK. Reply with exactly REALTIME_AUDIO_OK.';
const LIVE_FIXTURES_DIR = path.join(process.cwd(), 'src/smoke/live/fixtures');

function loadGatewayKeyFromEnv(): string | undefined {
  const apiKey = process.env.SPIRIT_API_KEY?.trim()
    || process.env.OPENAI_API_KEY?.trim();
  return apiKey && apiKey.length > 0 ? apiKey : undefined;
}

async function collectEvents(
  session: ReturnType<typeof createRealtimeSession>,
  timeoutMs: number,
): Promise<RealtimeEvent[]> {
  const events: RealtimeEvent[] = [];
  const timeout = setTimeout(() => {
    void session.disconnect();
  }, timeoutMs);

  try {
    for await (const event of session.events()) {
      events.push(event);
      if (event.type === 'response-done' || event.type === 'error' || event.type === 'disconnected') {
        break;
      }
    }
  } finally {
    clearTimeout(timeout);
  }

  return events;
}

function summarizeEvents(events: readonly RealtimeEvent[]) {
  const text = events
    .filter((event) => event.type === 'text-delta' || event.type === 'audio-transcript-delta')
    .map((event) => event.type === 'text-delta' || event.type === 'audio-transcript-delta' ? event.text : '')
    .join('');

  const audioChunks = events
    .filter((event) => event.type === 'audio-delta')
    .map((event) => event.data);

  return {
    eventTypes: events.map((event) => event.type),
    text,
    audioChunkCount: audioChunks.length,
    audioBytes: audioChunks.reduce((sum, chunk) => sum + chunk.length, 0),
  };
}

async function runTextCase(apiKey: string): Promise<void> {
  const session = createRealtimeSession({
    providerId: 'vercel-ai-gateway',
    model: MODEL_ID,
    apiKey,
    sessionConfig: {
      instructions: 'You are a concise assistant for smoke testing.',
      outputModalities: ['text', 'audio'],
      turnDetection: { type: 'disabled' },
      inputAudioTranscription: true,
      outputAudioTranscription: true,
      voice: 'alloy',
      inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
      outputAudioFormat: { type: 'audio/pcm', rate: 24000 },
    },
  });

  await session.connect();
  try {
    await session.sendText(TEXT_PROMPT);
    await session.requestResponse();
    const events = await collectEvents(session, 60_000);
    const summary = summarizeEvents(events);
    printSmokeSection('realtime gateway live text smoke', summary);

    if (!summary.text.includes('REALTIME_TEXT_OK')) {
      throw new Error(`realtime gateway live text smoke 未收到预期文本: ${summary.text || '<empty>'}`);
    }
  } finally {
    await session.disconnect();
  }
}

async function runAudioCase(apiKey: string): Promise<void> {
  const audioPath = path.join(LIVE_FIXTURES_DIR, 'sample.wav');
  const audio = await readFile(audioPath);
  const session = createRealtimeSession({
    providerId: 'vercel-ai-gateway',
    model: MODEL_ID,
    apiKey,
    sessionConfig: {
      instructions: AUDIO_PROMPT,
      outputModalities: ['text', 'audio'],
      turnDetection: { type: 'disabled' },
      inputAudioTranscription: true,
      outputAudioTranscription: true,
      voice: 'alloy',
      inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
      outputAudioFormat: { type: 'audio/pcm', rate: 24000 },
    },
  });

  await session.connect();
  try {
    await session.sendAudio(Uint8Array.from(audio), 'audio/wav');
    await session.requestResponse();
    const events = await collectEvents(session, 90_000);
    const summary = summarizeEvents(events);
    printSmokeSection('realtime gateway live audio smoke', {
      ...summary,
      audioFixturePath: audioPath,
    });

    const hasTranscript = events.some((event) => event.type === 'input-transcription-completed');
    const hasResponseText = summary.text.length > 0 || summary.audioChunkCount > 0;
    if (!hasTranscript && !hasResponseText) {
      throw new Error('realtime gateway live audio smoke 未收到转写或响应输出。');
    }
  } finally {
    await session.disconnect();
  }
}

async function main(): Promise<void> {
  if (!shouldRunLiveSmoke()) {
    return;
  }

  const apiKey = loadGatewayKeyFromEnv();
  if (!apiKey) {
    throw new Error(
      'realtime gateway live smoke 需要设置 SPIRIT_API_KEY 或 OPENAI_API_KEY 环境变量。',
    );
  }

  await runTextCase(apiKey);
  await runAudioCase(apiKey);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`realtime gateway live smoke failed: ${message}`);
  process.exitCode = 1;
});

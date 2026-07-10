import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createGateway } from '@ai-sdk/gateway';

import { mapSdkRealtimeServerEvents, toSdkRealtimeSessionConfig } from '../../realtime/events.js';
import { normalizeGatewayServerEvent } from '../../realtime/gateway/wire-events.js';
import { printSmokeSection } from '../shared/print.js';

const FIXTURE_PATH = path.join(
  process.cwd(),
  'src/smoke/contract/fixtures/gateway-interrupt-events.json',
);

async function main(): Promise<void> {
  const provider = createGateway({ apiKey: 'test-key' });
  const codec = provider.experimental_realtime('openai/gpt-realtime-2');
  const fixtureRaw = JSON.parse(await readFile(FIXTURE_PATH, 'utf8')) as unknown[];

  const mappedEvents = fixtureRaw.flatMap((raw) => {
    const parsed = normalizeGatewayServerEvent(codec.parseServerEvent(raw));
    return mapSdkRealtimeServerEvents(parsed);
  });

  const cancelSerialized = await codec.serializeClientEvent({ type: 'response-cancel' });
  const appendSerialized = await codec.serializeClientEvent({
    type: 'input-audio-append',
    audio: 'AQID',
  });
  const commitSerialized = await codec.serializeClientEvent({ type: 'input-audio-commit' });
  const clearSerialized = await codec.serializeClientEvent({ type: 'input-audio-clear' });

  const vadSessionConfig = toSdkRealtimeSessionConfig({
    turnDetection: {
      type: 'server-vad',
      createResponse: true,
      interruptResponse: true,
    },
    inputAudioFormat: { type: 'audio/pcm', rate: 24000 },
  });

  printSmokeSection('realtime gateway interrupt codec smoke', {
    mappedEventTypes: mappedEvents.map((event) => event.type),
    cancelSerialized,
    appendSerialized,
    commitSerialized,
    clearSerialized,
    vadSessionConfig,
  });

  const speechStarted = mappedEvents.find((event) => event.type === 'speech-started');
  const speechStopped = mappedEvents.find((event) => event.type === 'speech-stopped');
  const responseDone = mappedEvents.find((event) => event.type === 'response-done');

  if (!speechStarted || speechStarted.type !== 'speech-started' || speechStarted.itemId !== 'item_interrupt_fixture') {
    throw new Error('realtime gateway interrupt codec smoke 未映射 speech-started。');
  }
  if (!speechStopped || speechStopped.type !== 'speech-stopped') {
    throw new Error('realtime gateway interrupt codec smoke 未映射 speech-stopped。');
  }
  if (!responseDone || responseDone.type !== 'response-done' || responseDone.status !== 'cancelled') {
    throw new Error('realtime gateway interrupt codec smoke 未映射 response-done(cancelled)。');
  }

  const cancelRecord = cancelSerialized as Record<string, unknown>;
  const appendRecord = appendSerialized as Record<string, unknown>;
  if (cancelRecord.type !== 'response-cancel') {
    throw new Error('realtime gateway interrupt codec smoke response-cancel 序列化不符合预期。');
  }
  if (appendRecord.type !== 'input-audio-append' || appendRecord.audio !== 'AQID') {
    throw new Error('realtime gateway interrupt codec smoke input-audio-append 序列化不符合预期。');
  }

  const providerOptions = vadSessionConfig?.providerOptions as Record<string, unknown> | undefined;
  const audio = providerOptions?.audio as Record<string, unknown> | undefined;
  const input = audio?.input as Record<string, unknown> | undefined;
  const turnDetection = input?.turn_detection as Record<string, unknown> | undefined;
  if (
    turnDetection?.create_response !== true
    || turnDetection?.interrupt_response !== true
    || turnDetection?.type !== 'server_vad'
  ) {
    throw new Error('realtime gateway interrupt codec smoke VAD 打断配置未写入 providerOptions。');
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`realtime gateway interrupt codec smoke failed: ${message}`);
  process.exitCode = 1;
});

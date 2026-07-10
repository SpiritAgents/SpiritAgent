import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createGateway } from '@ai-sdk/gateway';

import { mapSdkRealtimeServerEvents } from '../../realtime/events.js';
import { normalizeGatewayServerEvent } from '../../realtime/gateway/wire-events.js';
import { printSmokeSection } from '../shared/print.js';

const FIXTURE_PATH = path.join(process.cwd(), 'src/smoke/contract/fixtures/gateway-server-events.json');

async function main(): Promise<void> {
  const provider = createGateway({ apiKey: 'test-key' });
  const codec = provider.experimental_realtime('openai/gpt-realtime-2');
  const fixtureRaw = JSON.parse(await readFile(FIXTURE_PATH, 'utf8')) as unknown[];

  const mappedEvents = fixtureRaw.flatMap((raw) => {
    const parsed = normalizeGatewayServerEvent(codec.parseServerEvent(raw));
    return mapSdkRealtimeServerEvents(parsed);
  });

  const serialized = await codec.serializeClientEvent({
    type: 'conversation-item-create',
    item: {
      type: 'text-message',
      role: 'user',
      text: 'Say hello in one sentence.',
    },
  });

  printSmokeSection('realtime gateway codec smoke', {
    mappedEventTypes: mappedEvents.map((event) => event.type),
    serializedClientEvent: serialized,
  });

  const hasSessionCreated = mappedEvents.some((event) => event.type === 'session-created');
  const hasTextDelta = mappedEvents.some((event) => event.type === 'text-delta');
  const hasAudioDelta = mappedEvents.some((event) => event.type === 'audio-delta');
  const hasResponseDone = mappedEvents.some((event) => event.type === 'response-done');

  if (!hasSessionCreated || !hasTextDelta || !hasAudioDelta || !hasResponseDone) {
    throw new Error('realtime gateway codec smoke 未映射出预期的 Spirit 事件。');
  }

  const serializedRecord = serialized as Record<string, unknown>;
  if (serializedRecord.type !== 'conversation-item-create') {
    throw new Error('realtime gateway codec smoke serializeClientEvent 类型不符合预期。');
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`realtime gateway codec smoke failed: ${message}`);
  process.exitCode = 1;
});

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createGateway } from '@ai-sdk/gateway';

import { mapSdkRealtimeServerEvents } from '../../realtime/events.js';
import { normalizeGatewayServerEvent } from '../../realtime/gateway/wire-events.js';
import { printSmokeSection } from '../shared/print.js';

const FIXTURE_PATH = path.join(
  process.cwd(),
  'src/smoke/contract/fixtures/gateway-tool-events.json',
);

async function main(): Promise<void> {
  const provider = createGateway({ apiKey: 'test-key' });
  const codec = provider.experimental_realtime('openai/gpt-realtime-2');
  const fixtureRaw = JSON.parse(await readFile(FIXTURE_PATH, 'utf8')) as unknown[];

  const mappedEvents = fixtureRaw.flatMap((raw) => {
    const parsed = normalizeGatewayServerEvent(codec.parseServerEvent(raw));
    return mapSdkRealtimeServerEvents(parsed);
  });

  const toolOutputSerialized = await codec.serializeClientEvent({
    type: 'conversation-item-create',
    item: {
      type: 'function-call-output',
      callId: 'call_tool_fixture',
      output: '{"query":"Spirit Agent migration","result":"transport bridge ok"}',
      name: 'demo_lookup',
    },
  });

  printSmokeSection('realtime gateway tool codec smoke', {
    mappedEventTypes: mappedEvents.map((event) => event.type),
    toolOutputSerialized,
  });

  const hasArgumentsDelta = mappedEvents.some(
    (event) => event.type === 'function-call-arguments-delta',
  );
  const argumentsDone = mappedEvents.find(
    (event) => event.type === 'function-call-arguments-done',
  );
  if (!hasArgumentsDelta || !argumentsDone || argumentsDone.type !== 'function-call-arguments-done') {
    throw new Error('realtime gateway tool codec smoke 未映射 function-call 事件。');
  }
  if (argumentsDone.name !== 'demo_lookup' || argumentsDone.callId !== 'call_tool_fixture') {
    throw new Error('realtime gateway tool codec smoke function-call-arguments-done 字段不符合预期。');
  }

  const serializedRecord = toolOutputSerialized as Record<string, unknown>;
  if (serializedRecord.type !== 'conversation-item-create') {
    throw new Error('realtime gateway tool codec smoke function-call-output 序列化类型不符合预期。');
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`realtime gateway tool codec smoke failed: ${message}`);
  process.exitCode = 1;
});

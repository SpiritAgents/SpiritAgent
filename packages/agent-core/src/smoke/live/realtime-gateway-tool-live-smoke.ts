import { createRealtimeToolSession } from '../../realtime/service.js';
import type { RealtimeEvent } from '../../realtime/types.js';
import { DemoToolExecutor } from '../shared/demo-tool.js';
import { printSmokeSection } from '../shared/print.js';
import { shouldRunLiveSmoke } from './env.js';

const MODEL_ID = 'openai/gpt-realtime-2';
const TOOL_PROMPT = [
  'Call demo_lookup exactly once with query "Spirit Agent migration".',
  'After the tool result is returned, answer with exactly REALTIME_TOOL_OK and nothing else.',
].join(' ');

function loadGatewayKeyFromEnv(): string | undefined {
  const apiKey = process.env.SPIRIT_API_KEY?.trim()
    || process.env.OPENAI_API_KEY?.trim();
  return apiKey && apiKey.length > 0 ? apiKey : undefined;
}

function summarizeEvents(events: readonly RealtimeEvent[]) {
  const text = events
    .filter((event) => event.type === 'text-delta')
    .map((event) => event.text)
    .join('');

  return {
    eventTypes: events.map((event) => event.type),
    text,
    hasFunctionCallDone: events.some((event) => event.type === 'function-call-arguments-done'),
    responseDoneCount: events.filter((event) => event.type === 'response-done').length,
  };
}

async function runToolCase(apiKey: string): Promise<void> {
  const toolExecutor = new DemoToolExecutor();
  const { session, runner } = createRealtimeToolSession(
    {
      providerId: 'vercel-ai-gateway',
      model: MODEL_ID,
      apiKey,
      sessionConfig: {
        instructions: 'You are a concise assistant for smoke testing.',
        outputModalities: ['text'],
        turnDetection: { type: 'disabled' },
      },
    },
    toolExecutor,
  );

  const events: RealtimeEvent[] = [];
  let accumulatedText = '';
  let sawFunctionCallDone = false;

  await session.connect();
  const timeout = setTimeout(() => {
    void session.disconnect();
  }, 120_000);

  try {
    await session.sendText(TOOL_PROMPT);
    await session.requestResponse();

    for await (const event of session.events()) {
      events.push(event);
      await runner.processEvent(event);

      if (event.type === 'function-call-arguments-done') {
        sawFunctionCallDone = true;
      }
      if (event.type === 'text-delta') {
        accumulatedText += event.text;
      }

      if (
        sawFunctionCallDone
        && accumulatedText.includes('REALTIME_TOOL_OK')
        && event.type === 'response-done'
      ) {
        break;
      }
      if (event.type === 'error' || event.type === 'disconnected') {
        break;
      }
    }
  } finally {
    clearTimeout(timeout);
    runner.stop();
    await session.disconnect();
  }

  const summary = summarizeEvents(events);
  printSmokeSection('realtime gateway tool live smoke', summary);

  if (!summary.hasFunctionCallDone) {
    throw new Error(
      `realtime gateway tool live smoke 未收到 function-call-arguments-done: ${JSON.stringify(summary)}`,
    );
  }
  if (!summary.text.includes('REALTIME_TOOL_OK')) {
    throw new Error(
      `realtime gateway tool live smoke 未收到预期文本: ${summary.text || '<empty>'}`,
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
      'realtime gateway tool live smoke 需要设置 SPIRIT_API_KEY 或 OPENAI_API_KEY 环境变量。',
    );
  }

  await runToolCase(apiKey);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`realtime gateway tool live smoke failed: ${message}`);
  process.exitCode = 1;
});

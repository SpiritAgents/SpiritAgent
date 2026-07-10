import { RealtimeCapabilityError } from '../../realtime/errors.js';
import { createRealtimeSession } from '../../realtime/service.js';
import { printSmokeSection } from '../shared/print.js';

async function main(): Promise<void> {
  const session = createRealtimeSession({
    providerId: 'vercel-ai-gateway',
    model: 'openai/gpt-realtime-2',
    apiKey: 'test-key',
  });

  let caught: RealtimeCapabilityError | undefined;
  try {
    await session.sendImage(Uint8Array.from([1, 2, 3]), 'image/png');
  } catch (error) {
    if (error instanceof RealtimeCapabilityError) {
      caught = error;
    } else {
      throw error;
    }
  }

  printSmokeSection('realtime gateway image unsupported smoke', {
    providerId: caught?.providerId ?? null,
    capability: caught?.capability ?? null,
    message: caught?.message ?? null,
  });

  if (!caught) {
    throw new Error('realtime gateway image unsupported smoke 未抛出 RealtimeCapabilityError。');
  }

  if (caught.capability !== 'image-input') {
    throw new Error(`realtime gateway image unsupported smoke capability 异常: ${caught.capability}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`realtime gateway image unsupported smoke failed: ${message}`);
  process.exitCode = 1;
});

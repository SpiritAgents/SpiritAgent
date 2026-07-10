import { resolveRealtimeBackend } from '../../realtime/router.js';
import { printSmokeSection } from '../shared/print.js';

async function main(): Promise<void> {
  const gatewayBackend = resolveRealtimeBackend({
    providerId: 'vercel-ai-gateway',
    model: 'openai/gpt-realtime-2',
    apiKey: 'test-key',
  });

  printSmokeSection('realtime router smoke', {
    gatewayBackendId: gatewayBackend.id,
    gatewayConnectionKind: gatewayBackend.connectionKind,
  });

  if (gatewayBackend.id !== 'ai-sdk-gateway-realtime') {
    throw new Error('realtime router smoke 未路由到 Gateway backend。');
  }

  const openAiBackend = resolveRealtimeBackend({
    providerId: 'openai',
    model: 'gpt-realtime',
    apiKey: 'test-key',
    connectionKind: 'webrtc',
  });

  if (openAiBackend.id !== 'openai-webrtc-stub') {
    throw new Error('realtime router smoke 未路由到 OpenAI WebRTC stub。');
  }

  let unknownThrown = false;
  try {
    resolveRealtimeBackend({
      providerId: 'custom' as never,
      model: 'unknown/model',
      apiKey: 'test-key',
    });
  } catch {
    unknownThrown = true;
  }

  if (!unknownThrown) {
    throw new Error('realtime router smoke 预期未知 provider 抛错。');
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`realtime router smoke failed: ${message}`);
  process.exitCode = 1;
});

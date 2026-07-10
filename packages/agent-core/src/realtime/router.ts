import type { RealtimeConfig } from './types.js';
import type { RealtimeBackend } from './types.js';
import { AiSdkGatewayRealtimeBackend } from './gateway/backend.js';
import { OpenAiRealtimeBackendStub } from './openai/backend.stub.js';

const gatewayBackend = new AiSdkGatewayRealtimeBackend();
const openAiBackendStub = new OpenAiRealtimeBackendStub();

export function resolveRealtimeBackend(config: RealtimeConfig): RealtimeBackend {
  if (config.providerId === 'vercel-ai-gateway') {
    return gatewayBackend;
  }

  if (config.providerId === 'openai') {
    return openAiBackendStub;
  }

  throw new Error(`No realtime backend is configured for provider ${config.providerId}.`);
}

import type { LlmTransport } from '../ports.js';

import { AiSdkOpenAiTransport } from './ai-sdk-transport.js';
import type { OpenAiTransportConfig } from './openai-compat.js';
import { OpenAiTransport, type OpenAiToolAgentState } from './transport.js';

export type OpenAiCompatibleTransport = LlmTransport<
  OpenAiTransportConfig,
  OpenAiToolAgentState
>;

export function resolveOpenAiTransportImplementation(
  config?: Pick<OpenAiTransportConfig, 'transportImplementation'>,
): 'openai-node' | 'ai-sdk' {
  return config?.transportImplementation === 'ai-sdk' ? 'ai-sdk' : 'openai-node';
}

export function createOpenAiCompatibleTransport(
  config?: Pick<OpenAiTransportConfig, 'transportImplementation'>,
): OpenAiCompatibleTransport {
  return resolveOpenAiTransportImplementation(config) === 'ai-sdk'
    ? new AiSdkOpenAiTransport()
    : new OpenAiTransport();
}
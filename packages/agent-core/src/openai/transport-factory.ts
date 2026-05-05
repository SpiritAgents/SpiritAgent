import type { LlmTransport } from '../ports.js';

import { AiSdkOpenAiTransport } from './ai-sdk-transport.js';
import type { OpenAiTransportConfig } from './openai-compat.js';
import type { OpenAiJsonSchemaTransport } from './json-schema.js';
import { OpenAiTransport, type OpenAiToolAgentState } from './transport.js';

export type OpenAiCompatibleTransport = LlmTransport<
  OpenAiTransportConfig,
  OpenAiToolAgentState
>;

export function resolveOpenAiTransportImplementation(
  config?: Pick<OpenAiTransportConfig, 'transportImplementation'>,
): 'openai-node' | 'ai-sdk' {
  return config?.transportImplementation === 'openai-node' ? 'openai-node' : 'ai-sdk';
}

export function createOpenAiCompatibleTransport(
  config?: Pick<OpenAiTransportConfig, 'transportImplementation'>,
): OpenAiCompatibleTransport {
  return resolveOpenAiTransportImplementation(config) === 'ai-sdk'
    ? new AiSdkOpenAiTransport()
    : new OpenAiTransport();
}

export function createOpenAiJsonSchemaTransport(
  config?: Pick<OpenAiTransportConfig, 'transportImplementation'>,
): OpenAiJsonSchemaTransport {
  return resolveOpenAiTransportImplementation(config) === 'ai-sdk'
    ? new AiSdkOpenAiTransport()
    : new OpenAiTransport();
}
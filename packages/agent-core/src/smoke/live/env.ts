import type { AnthropicTransportConfig } from '../../anthropic/anthropic-compat.js';
import type { BedrockTransportConfig } from '../../bedrock/bedrock-compat.js';
import type { OpenAiLlmVendor, OpenAiTransportConfig } from '../../openai/openai-compat.js';

import { requireEnv } from '../shared/env.js';

export const LIVE_SMOKE_GATE_ENV = 'SPIRIT_AGENT_ALLOW_LIVE_SMOKE';

const OPENAI_LLM_VENDOR_ENV = 'OPENAI_LLM_VENDOR';
const LIVE_SMOKE_VENDOR_VALUES = new Set<OpenAiLlmVendor>([
  'deepseek',
  'moonshot-ai',
  'minimax',
  'alibaba',
  'custom',
]);

export function shouldRunLiveSmoke(): boolean {
  if (process.env[LIVE_SMOKE_GATE_ENV] === '1') {
    return true;
  }

  console.log(`${LIVE_SMOKE_GATE_ENV}=1 未设置，跳过 live smoke。`);
  return false;
}

export function createLiveOpenAiCompatibleSmokeConfig(): OpenAiTransportConfig {
  const apiKey = requireEnv('OPENAI_API_KEY', 'SPIRIT_API_KEY');
  const model = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';
  const baseUrl = process.env.OPENAI_BASE_URL ?? process.env.SPIRIT_API_BASE;
  const llmVendor = parseLiveSmokeVendor(process.env[OPENAI_LLM_VENDOR_ENV]);

  return {
    apiKey,
    model,
    ...(baseUrl ? { baseUrl } : {}),
    ...(llmVendor ? { llmVendor } : {}),
  };
}

export function createLiveAnthropicSmokeConfig(): AnthropicTransportConfig {
  const apiKey = requireEnv('ANTHROPIC_API_KEY');
  const model = requireEnv('ANTHROPIC_MODEL');
  const baseUrl = requireEnv('ANTHROPIC_BASE_URL');

  return {
    transportKind: 'anthropic',
    apiKey,
    model,
    baseUrl,
  };
}

export function createLiveBedrockSmokeConfig(): BedrockTransportConfig {
  const region = requireEnv('AWS_REGION', 'AWS_DEFAULT_REGION');
  const model = requireEnv('BEDROCK_MODEL', 'AWS_BEDROCK_MODEL');
  const apiKey = process.env.AWS_BEDROCK_API_KEY?.trim()
    || process.env.BEDROCK_API_KEY?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const baseUrl = process.env.BEDROCK_BASE_URL?.trim()
    || process.env.AWS_BEDROCK_BASE_URL?.trim();

  if (!apiKey && !(accessKeyId && secretAccessKey)) {
    throw new Error(
      'Bedrock live smoke 需要 AWS_BEDROCK_API_KEY/BEDROCK_API_KEY，或 AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY。',
    );
  }

  return {
    transportKind: 'bedrock',
    model,
    region,
    ...(apiKey ? { apiKey } : {}),
    ...(accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : {}),
    ...(baseUrl ? { baseUrl } : {}),
  };
}

function parseLiveSmokeVendor(value: string | undefined): OpenAiLlmVendor | undefined {
  if (!value || !value.trim()) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!LIVE_SMOKE_VENDOR_VALUES.has(normalized as OpenAiLlmVendor)) {
    throw new Error(
      `${OPENAI_LLM_VENDOR_ENV} 仅支持 ${Array.from(LIVE_SMOKE_VENDOR_VALUES).join(', ')}，实际为 ${value}`,
    );
  }

  return normalized as OpenAiLlmVendor;
}

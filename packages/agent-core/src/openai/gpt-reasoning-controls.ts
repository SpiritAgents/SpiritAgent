import { parseOpenAiGptModelVersion } from '../open-responses/apply-patch-eligibility.js';
import { normalizeGatewayOpenAiModelId } from '../open-responses/responses-compat.js';
import type { ModelReasoningEffortContext, ModelReasoningProvider } from '../reasoning-effort.js';

export type ModelReasoningMode = 'standard' | 'pro';

const OPENAI_GPT56_REASONING_EFFORTS = [
  'none',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const;

export type OpenAiGpt56ReasoningEffort = (typeof OPENAI_GPT56_REASONING_EFFORTS)[number];

const OPENAI_GPT56_ROUTED_PROVIDERS = new Set<ModelReasoningProvider>([
  'openai',
  'azure',
  'vercel-ai-gateway',
  'cloudflare-ai-gateway',
  'openrouter',
]);

function resolveOpenAiModelIdForVersionCheck(modelId: string): string {
  const trimmed = modelId.trim();
  const gatewayId = normalizeGatewayOpenAiModelId(trimmed);
  if (gatewayId) {
    return gatewayId;
  }

  const lower = trimmed.toLowerCase();
  const openrouterPrefix = 'openai/';
  if (lower.startsWith(openrouterPrefix)) {
    return trimmed.slice(openrouterPrefix.length).trim();
  }

  return trimmed;
}

export function isOpenAiGpt56OrLaterModel(modelId: string): boolean {
  const version = parseOpenAiGptModelVersion(resolveOpenAiModelIdForVersionCheck(modelId));
  if (!version) {
    return false;
  }

  if (version.major > 5) {
    return true;
  }

  return version.major === 5 && version.minor >= 6;
}

export function openAiGpt56SupportedReasoningEfforts(): readonly OpenAiGpt56ReasoningEffort[] {
  return OPENAI_GPT56_REASONING_EFFORTS;
}

function isOpenAiGpt56RoutedProvider(provider: ModelReasoningProvider | undefined): boolean {
  return provider !== undefined && OPENAI_GPT56_ROUTED_PROVIDERS.has(provider);
}

export function modelSupportsOpenAiGpt56ReasoningControls(
  context?: Pick<ModelReasoningEffortContext, 'provider' | 'model'>,
): boolean {
  const model = context?.model?.trim();
  if (!model || !isOpenAiGpt56RoutedProvider(context?.provider)) {
    return false;
  }

  return isOpenAiGpt56OrLaterModel(model);
}

export function modelSupportsReasoningModeControl(
  context?: Pick<ModelReasoningEffortContext, 'provider' | 'model'>,
): boolean {
  return modelSupportsOpenAiGpt56ReasoningControls(context);
}

export function normalizeModelReasoningMode(value: unknown): ModelReasoningMode | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim().toLowerCase();
  if (trimmed === 'standard' || trimmed === 'pro') {
    return trimmed;
  }

  return undefined;
}

export function resolveModelReasoningMode(
  value: unknown,
  context?: Pick<ModelReasoningEffortContext, 'provider' | 'model'>,
): ModelReasoningMode {
  if (!modelSupportsOpenAiGpt56ReasoningControls(context)) {
    return 'standard';
  }

  return normalizeModelReasoningMode(value) ?? 'standard';
}

export function resolveOpenAiTransportReasoningModeForContext(
  value: unknown,
  context?: Pick<ModelReasoningEffortContext, 'provider' | 'model'>,
): ModelReasoningMode | undefined {
  const mode = resolveModelReasoningMode(value, context);
  return mode === 'pro' ? 'pro' : undefined;
}

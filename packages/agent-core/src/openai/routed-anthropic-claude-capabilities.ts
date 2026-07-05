import type { AnthropicEffort } from '../anthropic/anthropic-compat.js';
import type { OpenAiTransportConfig } from './openai-compat.js';

export type RoutedAnthropicThinkingMode = 'adaptive' | 'budget' | 'none';

export interface RoutedAnthropicClaudeCapabilities {
  thinkingMode: RoutedAnthropicThinkingMode;
  supportedEfforts: readonly AnthropicEffort[];
  adaptiveDisplay?: 'summarized';
  /** false 时 API 不接受 thinking: disabled（如 Claude Fable/Mythos 5 常开 adaptive thinking）。 */
  thinkingSwitchable?: boolean;
}

const CLAUDE_5_FULL_EFFORTS: readonly AnthropicEffort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

/** Claude 5 代际中 thinking 常开的族（fable / mythos）。 */
const CLAUDE_5_ALWAYS_ON_ADAPTIVE_FAMILIES = new Set(['fable', 'mythos']);

export const ROUTED_ANTHROPIC_BUDGET_TOKENS_BY_EFFORT: Record<'low' | 'medium' | 'high', number> = {
  low: 4_000,
  medium: 8_000,
  high: 12_000,
};

export function normalizeRoutedAnthropicClaudeModelId(model: string): string {
  return model
    .trim()
    .toLowerCase()
    .replace(/^anthropic\//, '')
    .replace(/(\d)\.(\d)/g, '$1-$2');
}

export function isRoutedAnthropicClaudeModel(model: string): boolean {
  return model.trim().toLowerCase().startsWith('anthropic/claude-');
}

function parseClaudeModelFamilyAndGeneration(
  modelId: string,
): { family: string; generation: number } | undefined {
  const match = modelId.match(/claude-([a-z]+)-(\d+)/);
  const family = match?.[1];
  const generationText = match?.[2];
  if (family === undefined || generationText === undefined) {
    return undefined;
  }
  const generation = Number.parseInt(generationText, 10);
  if (!Number.isFinite(generation)) {
    return undefined;
  }
  return { family, generation };
}

/** Claude 5 代际（claude-{family}-5）：按族区分 adaptive 是否可关与 effort 档位。 */
function resolveClaude5GenerationCapabilities(
  modelId: string,
): RoutedAnthropicClaudeCapabilities | undefined {
  const parsed = parseClaudeModelFamilyAndGeneration(modelId);
  if (parsed?.generation !== 5) {
    return undefined;
  }

  if (CLAUDE_5_ALWAYS_ON_ADAPTIVE_FAMILIES.has(parsed.family)) {
    return {
      thinkingMode: 'adaptive',
      supportedEfforts: CLAUDE_5_FULL_EFFORTS,
      adaptiveDisplay: 'summarized',
      thinkingSwitchable: false,
    };
  }

  if (parsed.family === 'sonnet' || parsed.family === 'opus') {
    return {
      thinkingMode: 'adaptive',
      supportedEfforts: CLAUDE_5_FULL_EFFORTS,
      ...(parsed.family === 'opus' ? { adaptiveDisplay: 'summarized' as const } : {}),
    };
  }

  return undefined;
}

export function routedAnthropicClaudeThinkingSwitchable(
  capabilities: RoutedAnthropicClaudeCapabilities,
): boolean {
  if (capabilities.thinkingSwitchable === false) {
    return false;
  }
  return capabilities.thinkingMode === 'adaptive' || capabilities.thinkingMode === 'budget';
}

export function resolveRoutedAnthropicClaudeCapabilities(
  model: string,
): RoutedAnthropicClaudeCapabilities {
  const modelId = normalizeRoutedAnthropicClaudeModelId(model);

  const claude5Capabilities = resolveClaude5GenerationCapabilities(modelId);
  if (claude5Capabilities !== undefined) {
    return claude5Capabilities;
  }

  if (modelId.includes('claude-opus-4-7') || modelId.includes('claude-opus-4-8')) {
    return {
      thinkingMode: 'adaptive',
      supportedEfforts: ['low', 'medium', 'high', 'xhigh', 'max'],
      adaptiveDisplay: 'summarized',
    };
  }

  if (modelId.includes('claude-opus-4-6')) {
    return {
      thinkingMode: 'adaptive',
      supportedEfforts: ['low', 'medium', 'high', 'max'],
    };
  }

  if (modelId.includes('claude-sonnet-4-6')) {
    return {
      thinkingMode: 'adaptive',
      supportedEfforts: ['low', 'medium', 'high'],
    };
  }

  if (isLegacyRoutedAnthropicClaudeModel(modelId)) {
    return {
      thinkingMode: 'budget',
      supportedEfforts: [],
    };
  }

  return {
    thinkingMode: 'none',
    supportedEfforts: [],
  };
}

export function routedAnthropicClaudeSupportedEfforts(
  model: string,
): AnthropicEffort[] | undefined {
  if (!isRoutedAnthropicClaudeModel(model)) {
    return undefined;
  }

  const capabilities = resolveRoutedAnthropicClaudeCapabilities(model);
  if (capabilities.supportedEfforts.length === 0) {
    return undefined;
  }

  return [...capabilities.supportedEfforts];
}

function isLegacyRoutedAnthropicClaudeModel(modelId: string): boolean {
  if (!modelId.includes('claude')) {
    return false;
  }

  return (
    modelId.includes('haiku-4-5')
    || modelId.includes('opus-4-5')
    || modelId.includes('sonnet-4-5')
    || /claude-opus-4(?:-|$)/.test(modelId)
    || /claude-sonnet-4(?:-|$)/.test(modelId)
    || modelId.includes('claude-opus-4-1')
  );
}

export function routedAnthropicEffortFromReasoningEffort(
  reasoningEffort: OpenAiTransportConfig['reasoningEffort'],
  supportedEfforts: readonly AnthropicEffort[],
): AnthropicEffort | undefined {
  if (reasoningEffort === undefined || reasoningEffort === 'default') {
    return undefined;
  }

  const effort = reasoningEffort as AnthropicEffort;
  return supportedEfforts.includes(effort) ? effort : undefined;
}

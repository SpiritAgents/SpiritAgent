import type { AnthropicThinkingConfig } from './anthropic/anthropic-compat.js';
import type { ModelReasoningEffortContext } from './reasoning-effort.js';
import {
  isDeepSeekV4ReasoningEffortModel,
  isGatewayAnthropicClaudeReasoningModel,
  isGoogleReasoningEffortModel,
  isMoonshotReasoningEffortModel,
  isOpenRouterAnthropicClaudeReasoningModel,
  isXaiReasoningEffortModel,
  isAnthropicReasoningEffortModel,
} from './reasoning-effort.js';
import { parseGatewayUpstreamSlug } from './openai/gateway-code-completion-thinking.js';
import {
  isRoutedAnthropicClaudeModel,
  resolveRoutedAnthropicClaudeCapabilities,
  type RoutedAnthropicClaudeCapabilities,
} from './openai/routed-anthropic-claude-capabilities.js';

const DIRECT_THINKING_SWITCH_PROVIDERS = new Set([
  'z-ai',
  'zhipu-ai',
  'minimax',
  'xiaomi',
  'volcengine',
  'alibaba',
  'siliconflow',
]);

const GATEWAY_REASONING_EFFORT_SLUGS = new Set([
  'openai',
  'google',
  'anthropic',
  'moonshotai',
  'xai',
]);

export type ModelEffortControlLabelKind = 'effort' | 'reasoningEffort';

function normalizeModelId(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function routedAnthropicModelId(context?: ModelReasoningEffortContext): string | undefined {
  const model = context?.model?.trim();
  if (!model) {
    return undefined;
  }
  if (isRoutedAnthropicClaudeModel(model)) {
    return model;
  }
  const prefixed = `anthropic/${model}`;
  return isRoutedAnthropicClaudeModel(prefixed) ? prefixed : undefined;
}

function resolveAnthropicClaudeCapabilitiesForContext(
  context?: ModelReasoningEffortContext,
): RoutedAnthropicClaudeCapabilities | undefined {
  const modelId = routedAnthropicModelId(context);
  if (modelId === undefined) {
    return undefined;
  }
  return resolveRoutedAnthropicClaudeCapabilities(modelId);
}

/** Anthropic Claude（直连 / Gateway / OpenRouter）：UI 与 wire 语义为 Effort，非 Reasoning Effort。 */
export function isAnthropicClaudeEffortModel(context?: ModelReasoningEffortContext): boolean {
  return isAnthropicReasoningEffortModel(context)
    || isGatewayAnthropicClaudeReasoningModel(context)
    || isOpenRouterAnthropicClaudeReasoningModel(context);
}

/** Claude adaptive thinking：可开关 thinking.type=adaptive，并与 Effort 共存。 */
export function isAnthropicClaudeAdaptiveThinkingModel(
  context?: ModelReasoningEffortContext,
): boolean {
  const capabilities = resolveAnthropicClaudeCapabilitiesForContext(context);
  return capabilities?.thinkingMode === 'adaptive';
}

export function modelEffortControlLabelKind(
  context?: ModelReasoningEffortContext,
): ModelEffortControlLabelKind {
  return isAnthropicClaudeEffortModel(context) ? 'effort' : 'reasoningEffort';
}

/** DeepSeek R1 / reasoner：始终思考，无 thinking toggle。 */
export function isDeepSeekReasoningOnlyModel(context?: ModelReasoningEffortContext): boolean {
  if (context?.provider !== 'deepseek') {
    return false;
  }
  const model = normalizeModelId(context.model);
  return model.includes('deepseek-reasoner')
    || model.includes('deepseek-r1')
    || model === 'deepseek-r1';
}

function isDeepSeekThinkingSwitchModel(context?: ModelReasoningEffortContext): boolean {
  if (context?.provider !== 'deepseek') {
    return false;
  }
  if (isDeepSeekReasoningOnlyModel(context)) {
    return false;
  }
  return true;
}

function isGatewayThinkingSwitchModel(context?: ModelReasoningEffortContext): boolean {
  if (context?.provider !== 'vercel-ai-gateway') {
    return false;
  }
  const slug = parseGatewayUpstreamSlug(context.model ?? '');
  if (slug === undefined) {
    return false;
  }
  return !GATEWAY_REASONING_EFFORT_SLUGS.has(slug);
}

function isGatewayReasoningEffortPrimaryControlModel(
  context?: ModelReasoningEffortContext,
): boolean {
  if (context?.provider !== 'vercel-ai-gateway') {
    return false;
  }
  const slug = parseGatewayUpstreamSlug(context.model ?? '');
  return slug !== undefined && GATEWAY_REASONING_EFFORT_SLUGS.has(slug);
}

/** OpenAI / Reasoning Effort 主控厂商：不显示 Thinking 开关（不含 DeepSeek V4 hybrid 与 Claude adaptive）。 */
export function modelUsesReasoningEffortPrimaryControl(
  context?: ModelReasoningEffortContext,
): boolean {
  if (isAnthropicClaudeAdaptiveThinkingModel(context)) {
    return false;
  }
  if (isDeepSeekV4ReasoningEffortModel(context)) {
    return false;
  }

  const provider = context?.provider;
  if (provider === 'openai' || provider === 'azure' || provider === 'amazon-bedrock') {
    return true;
  }
  if (provider === 'anthropic') {
    return true;
  }
  if (isXaiReasoningEffortModel(context) || isMoonshotReasoningEffortModel(context)) {
    return true;
  }
  if (isGoogleReasoningEffortModel(context)) {
    return true;
  }
  if (isGatewayReasoningEffortPrimaryControlModel(context)) {
    return true;
  }
  if (isOpenRouterAnthropicClaudeReasoningModel(context)) {
    return true;
  }

  return false;
}

export function modelSupportsThinkingSwitch(context?: ModelReasoningEffortContext): boolean {
  if (isAnthropicClaudeAdaptiveThinkingModel(context)) {
    return true;
  }
  if (modelUsesReasoningEffortPrimaryControl(context)) {
    return false;
  }
  if (isDeepSeekReasoningOnlyModel(context)) {
    return false;
  }

  const provider = context?.provider;
  if (provider !== undefined && DIRECT_THINKING_SWITCH_PROVIDERS.has(provider)) {
    return true;
  }
  if (isDeepSeekThinkingSwitchModel(context)) {
    return true;
  }
  if (isGatewayThinkingSwitchModel(context)) {
    return true;
  }

  return false;
}

/** DeepSeek V4：仅 thinking 开启时 API 接受 reasoning_effort（high/max）。 */
export function modelSupportsReasoningEffortWhileThinking(
  context?: ModelReasoningEffortContext,
): boolean {
  return isDeepSeekV4ReasoningEffortModel(context);
}

/**
 * Inspector：是否展示 Effort / Reasoning Effort 控件。
 * Claude Effort 模型始终展示；Reasoning Effort 主控模型始终展示；
 * 其余 thinking 型模型仅在 thinking 开启时展示。
 */
export function modelShowsReasoningEffortControl(
  context?: ModelReasoningEffortContext,
  thinkingEnabled?: boolean,
): boolean {
  if (isAnthropicClaudeEffortModel(context)) {
    return true;
  }
  if (modelUsesReasoningEffortPrimaryControl(context)) {
    return true;
  }
  if (!modelSupportsThinkingSwitch(context)) {
    return false;
  }
  return thinkingEnabled !== false;
}

export function resolveVendorExtendedThinking(thinkingEnabled?: boolean): boolean | undefined {
  if (thinkingEnabled === false) {
    return false;
  }
  return undefined;
}

/** thinking 关闭时剥离 reasoning effort；Claude Effort 与 Reasoning Effort 主控模型保留用户档位。 */
export function shouldPinReasoningEffortToDefault(
  thinkingEnabled: boolean | undefined,
  context?: ModelReasoningEffortContext,
): boolean {
  if (isAnthropicClaudeEffortModel(context)) {
    return false;
  }
  if (modelUsesReasoningEffortPrimaryControl(context)) {
    return false;
  }
  return thinkingEnabled === false;
}

export function resolveModelThinkingEnabled(thinkingEnabled?: boolean): boolean {
  return thinkingEnabled !== false;
}

/** Anthropic 直连 transport：显式 thinking 配置（adaptive / disabled）。 */
export function resolveAnthropicExplicitThinkingConfig(
  thinkingEnabled: boolean | undefined,
  context?: ModelReasoningEffortContext,
): AnthropicThinkingConfig | undefined {
  if (isAnthropicClaudeAdaptiveThinkingModel(context)) {
    if (thinkingEnabled === false) {
      return { type: 'disabled' };
    }
    const capabilities = resolveAnthropicClaudeCapabilitiesForContext(context);
    if (capabilities?.thinkingMode === 'adaptive') {
      return {
        type: 'adaptive',
        ...(capabilities.adaptiveDisplay ? { display: capabilities.adaptiveDisplay } : {}),
      };
    }
  }

  if (thinkingEnabled === false && modelSupportsThinkingSwitch(context)) {
    return { type: 'disabled' };
  }

  return undefined;
}

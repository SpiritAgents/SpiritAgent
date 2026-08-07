import type { ModelReasoningEffortContext, ModelReasoningProvider } from "../reasoning-effort.js";

export type ModelReasoningMode = "standard" | "pro";

const OPENAI_GPT56_REASONING_EFFORTS = ["none", "low", "medium", "high", "xhigh", "max"] as const;

export type OpenAiGpt56ReasoningEffort = (typeof OPENAI_GPT56_REASONING_EFFORTS)[number];

const OPENAI_GPT56_ROUTED_PROVIDERS = new Set<ModelReasoningProvider>([
  "openai",
  "azure",
  "vercel-ai-gateway",
  "cloudflare-ai-gateway",
  "openrouter",
]);

/** Renderer-safe：勿从 responses-compat 导入，避免 Desktop 前端拉入 AI SDK 依赖链。 */
function normalizeGatewayOpenAiModelId(model: string): string | undefined {
  const trimmed = model.trim();
  const lower = trimmed.toLowerCase();
  const prefix = "openai/";
  if (!lower.startsWith(prefix)) {
    return undefined;
  }

  return trimmed.slice(prefix.length).trim();
}

/** Renderer-safe：与 apply-patch-eligibility 逻辑对齐，独立副本避免 import 传递依赖。 */
function parseOpenAiGptModelVersion(modelId: string): { major: number; minor: number } | undefined {
  const trimmed = modelId.trim().toLowerCase();
  const bedrockMantle = /^openai\.(gpt-\d+(?:\.\d+)?)/.exec(trimmed);
  if (bedrockMantle?.[1]) {
    return parseOpenAiGptModelVersion(bedrockMantle[1]);
  }

  const versioned = /^gpt-(\d+)\.(\d+)/.exec(trimmed);
  if (versioned) {
    return {
      major: Number.parseInt(versioned[1] ?? "", 10),
      minor: Number.parseInt(versioned[2] ?? "", 10),
    };
  }

  const majorOnly = /^gpt-(\d+)(?:$|[-_])/.exec(trimmed);
  if (majorOnly) {
    return {
      major: Number.parseInt(majorOnly[1] ?? "", 10),
      minor: 0,
    };
  }

  return undefined;
}

function resolveOpenAiModelIdForVersionCheck(modelId: string): string {
  const trimmed = modelId.trim();
  const gatewayId = normalizeGatewayOpenAiModelId(trimmed);
  if (gatewayId) {
    return gatewayId;
  }

  const lower = trimmed.toLowerCase();
  const openrouterPrefix = "openai/";
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
  context?: Pick<ModelReasoningEffortContext, "provider" | "model">,
): boolean {
  const model = context?.model?.trim();
  if (!model || !isOpenAiGpt56RoutedProvider(context?.provider)) {
    return false;
  }

  return isOpenAiGpt56OrLaterModel(model);
}

export function modelSupportsReasoningModeControl(
  context?: Pick<ModelReasoningEffortContext, "provider" | "model">,
): boolean {
  return modelSupportsOpenAiGpt56ReasoningControls(context);
}

export function normalizeModelReasoningMode(value: unknown): ModelReasoningMode | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim().toLowerCase();
  if (trimmed === "standard" || trimmed === "pro") {
    return trimmed;
  }

  return undefined;
}

export function resolveModelReasoningMode(
  value: unknown,
  context?: Pick<ModelReasoningEffortContext, "provider" | "model">,
): ModelReasoningMode {
  if (!modelSupportsOpenAiGpt56ReasoningControls(context)) {
    return "standard";
  }

  return normalizeModelReasoningMode(value) ?? "standard";
}

export function resolveOpenAiTransportReasoningModeForContext(
  value: unknown,
  context?: Pick<ModelReasoningEffortContext, "provider" | "model">,
): ModelReasoningMode | undefined {
  const mode = resolveModelReasoningMode(value, context);
  return mode === "pro" ? "pro" : undefined;
}

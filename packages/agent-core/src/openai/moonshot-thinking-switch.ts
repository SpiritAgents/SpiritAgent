import type { JsonObject } from "../ports.js";
import type { ModelReasoningEffortContext } from "../reasoning-effort.js";
import type { OpenAiTransportConfig } from "./openai-compat.js";
import { openAiReasoningEffort } from "./openai-compat.js";
import { parseGatewayUpstreamSlug } from "./gateway-code-completion-thinking.js";

/** Docs: https://platform.kimi.com/docs/api/chat — only kimi-k2.5+ supports the thinking.type switch. */
function normalizeMoonshotModelId(model: string): string {
  const normalized = model.trim().toLowerCase();
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
}

function parseKimiKModelVersion(model: string): { major: number; minor: number } | undefined {
  const match = normalizeMoonshotModelId(model).match(/^kimi-k(\d+)(?:\.(\d+))?/);
  if (!match) {
    return undefined;
  }
  const majorText = match[1];
  if (majorText === undefined) {
    return undefined;
  }
  const major = Number.parseInt(majorText, 10);
  const minor = match[2] !== undefined ? Number.parseInt(match[2], 10) : 0;
  if (!Number.isFinite(major) || !Number.isFinite(minor)) {
    return undefined;
  }
  return { major, minor };
}

/** Docs: https://platform.kimi.com/docs/guide/use-thinking-effort — K3 always thinks, controlled only via the top-level reasoning_effort. */
export function isMoonshotKimiK3Model(model: string): boolean {
  return /^kimi-k3(?:-|$)/.test(normalizeMoonshotModelId(model));
}

/** moonshot-v1-*, kimi-k2.7-code-* (including highspeed), and kimi-k3 do not support the thinking.type switch. */
export function isMoonshotThinkingSwitchExcludedModel(model: string): boolean {
  const id = normalizeMoonshotModelId(model);
  if (id.startsWith("moonshot-v1-") || id === "moonshot-v1") {
    return true;
  }
  if (/^kimi-k2\.7-code(?:-|$)/.test(id)) {
    return true;
  }
  if (isMoonshotKimiK3Model(model)) {
    return true;
  }
  return false;
}

/** kimi-k2.5 and above (including future k2.x / k3+), excluding models that do not support thinking. */
export function isMoonshotThinkingSwitchEligibleModel(model: string): boolean {
  if (isMoonshotThinkingSwitchExcludedModel(model)) {
    return false;
  }
  const version = parseKimiKModelVersion(model);
  if (version === undefined) {
    return false;
  }
  if (version.major > 2) {
    return true;
  }
  return version.major === 2 && version.minor >= 5;
}

export function isMoonshotThinkingSwitchModel(context?: ModelReasoningEffortContext): boolean {
  if (context?.provider === "moonshot-ai") {
    return isMoonshotThinkingSwitchEligibleModel(context.model ?? "");
  }
  if (
    context?.provider === "vercel-ai-gateway" &&
    parseGatewayUpstreamSlug(context.model ?? "") === "moonshotai"
  ) {
    return isMoonshotThinkingSwitchEligibleModel(context.model ?? "");
  }
  return false;
}

export function isGatewayMoonshotModel(llmVendor: string | undefined, model: string): boolean {
  return llmVendor === "vercel-ai-gateway" && parseGatewayUpstreamSlug(model) === "moonshotai";
}

/** Gateway Moonshot: switch-capable models control thinking via the moonshotai namespace; reasoning_effort still goes through the openai namespace. */
export function buildGatewayMoonshotProviderOptions(
  config: Pick<
    OpenAiTransportConfig,
    "llmVendor" | "model" | "reasoningEffort" | "vendorExtendedThinking"
  >,
): Record<string, JsonObject> {
  if (!isGatewayMoonshotModel(config.llmVendor, config.model)) {
    return {};
  }

  const context: ModelReasoningEffortContext = {
    provider: "vercel-ai-gateway",
    model: config.model,
    transportKind: "openai-compatible",
  };
  if (!isMoonshotThinkingSwitchModel(context)) {
    return {};
  }

  if (config.vendorExtendedThinking === false) {
    return {
      moonshotai: {
        thinking: { type: "disabled" },
      } as JsonObject,
    };
  }

  const result: Record<string, JsonObject> = {
    moonshotai: {
      thinking: { type: "enabled" },
    } as JsonObject,
  };
  const effort = openAiReasoningEffort(config);
  if (effort !== undefined && effort !== "default" && effort !== "none") {
    result.openai = {
      reasoningEffort: effort,
    } as JsonObject;
  }
  return result;
}

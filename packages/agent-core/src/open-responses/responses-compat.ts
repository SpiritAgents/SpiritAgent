import type { JsonObject, JsonValue } from '../ports.js';
import type { LlmModelCapabilities } from '../llm-provider-shared.js';
import type { OpenAiLlmVendor } from '../openai/openai-compat.js';
import { resolveOpenAiTransportReasoningEffortForContext } from '../reasoning-effort.js';
import { cloneJsonValue } from '../tool-agent.js';

/** 底层 AI SDK provider：OpenAI 官方 Responses 或 Open Responses 兼容 endpoint。 */
export type OpenResponsesSdkProvider = 'openai' | 'open-responses-compatible';

export type OpenResponsesPreviousResponseMode = 'disabled' | 'stored' | 'stateless';

export type OpenResponsesReasoningSummary = 'auto' | 'detailed' | 'off';

export interface OpenResponsesTransportConfig {
  transportKind: 'open-responses';
  apiKey: string;
  model: string;
  baseUrl?: string;
  organization?: string;
  project?: string;
  compactModel?: string;
  workspaceRoot?: string;
  /**
   * 与宿主 `ModelProfile.provider` 对齐；用于推断默认 `responsesProvider`。
   */
  llmVendor?: OpenAiLlmVendor;
  modelCapabilities?: LlmModelCapabilities;
  /**
   * 显式指定底层 SDK。缺省时：`llmVendor === 'openai'` → `openai`，否则 `open-responses-compatible`。
   */
  responsesProvider?: OpenResponsesSdkProvider;
  /** OpenAI 官方 Responses：是否由 OpenAI 服务端存储会话。默认 false。 */
  store?: boolean;
  previousResponseMode?: OpenResponsesPreviousResponseMode;
  reasoningEffort?: 'default' | 'minimal' | 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  reasoningSummary?: OpenResponsesReasoningSummary;
  truncation?: 'disabled' | 'auto';
}

export type OpenResponsesRequestTraceKind =
  | 'openai_sdk_responses'
  | 'open_responses_sdk_responses';

export interface OpenResponsesRequestTrace extends JsonObject {
  kind: OpenResponsesRequestTraceKind;
  stepIndex: number;
  model: string;
  stream: boolean;
  input?: JsonValue;
  tools?: JsonValue[];
  store?: boolean;
  previousResponseId?: string;
  reasoning?: JsonValue;
  truncation?: string;
}

export function resolveOpenResponsesSdkProvider(
  config: Pick<OpenResponsesTransportConfig, 'llmVendor' | 'responsesProvider'>,
): OpenResponsesSdkProvider {
  if (config.responsesProvider !== undefined) {
    return config.responsesProvider;
  }

  return config.llmVendor === 'openai' ? 'openai' : 'open-responses-compatible';
}

export function openResponsesReasoningEffort(
  config: Pick<OpenResponsesTransportConfig, 'llmVendor' | 'model' | 'reasoningEffort'>,
): string | undefined {
  return resolveOpenAiTransportReasoningEffortForContext(config.reasoningEffort, {
    ...(config.llmVendor ? { provider: config.llmVendor } : {}),
    model: config.model,
    transportKind: 'open-responses',
  });
}

export function buildOpenResponsesRequestTrace(
  config: OpenResponsesTransportConfig,
  stepIndex: number,
  input: readonly JsonValue[],
  tools: readonly unknown[],
  stream = false,
  extras?: Pick<OpenResponsesRequestTrace, 'store' | 'previousResponseId' | 'reasoning' | 'truncation'>,
): JsonValue[] {
  const kind: OpenResponsesRequestTraceKind =
    resolveOpenResponsesSdkProvider(config) === 'openai'
      ? 'openai_sdk_responses'
      : 'open_responses_sdk_responses';

  const trace: OpenResponsesRequestTrace = {
    kind,
    stepIndex,
    model: config.model,
    stream,
    input: input.map((item) => cloneJsonValue(item)),
    ...(tools.length > 0
      ? { tools: tools.map((tool) => cloneJsonValue(tool as JsonValue)) }
      : {}),
    ...(extras?.store !== undefined ? { store: extras.store } : {}),
    ...(extras?.previousResponseId ? { previousResponseId: extras.previousResponseId } : {}),
    ...(extras?.reasoning !== undefined ? { reasoning: extras.reasoning } : {}),
    ...(extras?.truncation ? { truncation: extras.truncation } : {}),
  };

  return [trace];
}

export function normalizeOpenResponsesApiBase(baseUrl: string | undefined): string {
  const trimmed = (baseUrl ?? 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
  return trimmed.length > 0 ? trimmed : 'https://api.openai.com/v1';
}

export function openResponsesPostUrl(baseUrl: string | undefined): string {
  const normalized = normalizeOpenResponsesApiBase(baseUrl);
  return normalized.endsWith('/responses') ? normalized : `${normalized}/responses`;
}

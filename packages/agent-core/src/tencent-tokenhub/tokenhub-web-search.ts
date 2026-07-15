import { isCodeCompletionTransportProfile } from '../code-completion/transport-profile.js';
import type { OpenAiTransportConfig } from '../openai/openai-compat.js';
import { normalizeUpstreamModelId } from '../openai/thinking-switch-disabled-models.js';

const TOKEN_HUB_WEB_SEARCH_MODEL_IDS = new Set([
  'hy3-preview',
  'deepseek-v4-pro',
  'deepseek-v4-flash',
]);

const TOKEN_HUB_CN_API_HOSTS = new Set([
  'tokenhub.tencentmaas.com',
]);

export function isTokenHubCnApiBase(baseUrl: string | undefined): boolean {
  if (!baseUrl) {
    return false;
  }
  try {
    const host = new URL(baseUrl).hostname.trim().toLowerCase();
    return TOKEN_HUB_CN_API_HOSTS.has(host);
  } catch {
    return false;
  }
}

export function isTokenHubWebSearchModel(model: string): boolean {
  return TOKEN_HUB_WEB_SEARCH_MODEL_IDS.has(normalizeUpstreamModelId(model));
}

export function shouldUseTokenHubWebSearch(
  config: Pick<
    OpenAiTransportConfig,
    'llmVendor' | 'model' | 'baseUrl' | 'transportRequestProfile' | 'transportKind'
  >,
): boolean {
  if (config.llmVendor !== 'tencent-tokenhub') {
    return false;
  }
  if (config.transportKind !== undefined && config.transportKind !== 'openai-compatible') {
    return false;
  }
  if (isCodeCompletionTransportProfile(config)) {
    return false;
  }
  if (!isTokenHubCnApiBase(config.baseUrl)) {
    return false;
  }
  return isTokenHubWebSearchModel(config.model);
}

export function shouldPatchTokenHubChatCompletions(
  config: Pick<
    OpenAiTransportConfig,
    'llmVendor' | 'model' | 'baseUrl' | 'transportRequestProfile' | 'transportKind'
  >,
): boolean {
  return shouldUseTokenHubWebSearch(config);
}

export function buildTokenHubWebSearchRequestFields(): { web_search_options: { enable: true } } {
  return {
    web_search_options: {
      enable: true,
    },
  };
}

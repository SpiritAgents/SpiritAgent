import i18n from "@/lib/i18n";
import type { DesktopModelProvider, DesktopTransportKind } from "@/types";

export type ConnectTransportOption = {
  value: DesktopTransportKind;
  label: string;
  summaryKey?: string;
};

export const connectTransportOptionCatalog = {
  chatCompletions: {
    value: "openai-compatible" as const,
    label: "Chat Completions API",
  },
  messagesApi: {
    value: "anthropic" as const,
    label: "Messages API",
  },
  bedrockApi: {
    value: "bedrock" as const,
    label: "Amazon Bedrock",
  },
  responsesApi: {
    value: "open-responses" as const,
    label: "Responses API",
  },
  openResponsesApi: {
    value: "open-responses" as const,
    label: "Open Responses API",
  },
} satisfies Record<string, ConnectTransportOption>;

export function connectTransportOptionsForProvider(provider: DesktopModelProvider): ConnectTransportOption[] {
  switch (provider) {
    case "openai":
      return [];
    case "xai":
      return [connectTransportOptionCatalog.chatCompletions, connectTransportOptionCatalog.responsesApi];
    case "google":
    case "google-vertex-ai":
      return [connectTransportOptionCatalog.chatCompletions];
    case "minimax":
    case "deepseek":
    case "kimi-code":
    case "meituan":
      return [connectTransportOptionCatalog.chatCompletions, connectTransportOptionCatalog.messagesApi];
    // TokenHub 文档有 Chat web_search_options / Responses web_search 两套联网能力，实测 Chat 注入无效；
    // Responses 仅 hy3-preview 等少数模型支持，与 TokenHub 以 Chat Completions 为主的模型矩阵不匹配，故仅保留 Chat Completions。
    case "tencent-tokenhub":
      return [connectTransportOptionCatalog.chatCompletions];
    case "siliconflow":
      return [connectTransportOptionCatalog.chatCompletions, connectTransportOptionCatalog.messagesApi];
    case "xiaomi":
      return [
        connectTransportOptionCatalog.chatCompletions,
        connectTransportOptionCatalog.messagesApi,
        connectTransportOptionCatalog.openResponsesApi,
      ];
    case "alibaba":
      return [
        connectTransportOptionCatalog.chatCompletions,
        connectTransportOptionCatalog.messagesApi,
        connectTransportOptionCatalog.openResponsesApi,
      ];
    case "stepfun":
      return [
        connectTransportOptionCatalog.chatCompletions,
        connectTransportOptionCatalog.messagesApi,
        connectTransportOptionCatalog.openResponsesApi,
      ];
    case "openrouter":
    case "cloudflare-ai-gateway":
    case "custom":
      return [
        connectTransportOptionCatalog.chatCompletions,
        connectTransportOptionCatalog.openResponsesApi,
        connectTransportOptionCatalog.messagesApi,
      ];
    case "fireworks-ai":
      return [
        connectTransportOptionCatalog.chatCompletions,
        connectTransportOptionCatalog.messagesApi,
        connectTransportOptionCatalog.openResponsesApi,
      ];
    case "volcengine":
      return [
        connectTransportOptionCatalog.chatCompletions,
        connectTransportOptionCatalog.responsesApi,
      ];
    case "amazon-bedrock":
      return [connectTransportOptionCatalog.bedrockApi];
    case "azure":
      return [];
    default:
      return [];
  }
}

export function defaultConnectTransportKind(provider: DesktopModelProvider): DesktopTransportKind {
  if (provider === "vercel-ai-gateway") {
    return "open-responses";
  }
  if (provider === "amazon-bedrock") {
    return "bedrock";
  }
  if (provider === "azure" || provider === "openai") {
    return "open-responses";
  }

  return connectTransportOptionsForProvider(provider)[0]?.value ?? "openai-compatible";
}

export function providerSupportsConnectTransportPicker(
  provider: DesktopModelProvider | null,
): provider is DesktopModelProvider {
  return (
    provider === "xai" ||
    provider === "minimax" ||
    provider === "deepseek" ||
    provider === "kimi-code" ||
    provider === "meituan" ||
    provider === "xiaomi" ||
    provider === "siliconflow" ||
    provider === "alibaba" ||
    provider === "stepfun" ||
    provider === "custom" ||
    provider === "openrouter" ||
    provider === "cloudflare-ai-gateway" ||
    provider === "fireworks-ai" ||
    provider === "volcengine"
  );
}

export function providerShowsConnectTransportPicker(provider: DesktopModelProvider | null): boolean {
  return provider !== null
    && provider !== "vercel-ai-gateway"
    && providerSupportsConnectTransportPicker(provider);
}

export function resolveConnectTransportKindForProvider(
  provider: DesktopModelProvider | null,
  connectTransportKind: DesktopTransportKind,
): DesktopTransportKind | undefined {
  if (provider === "vercel-ai-gateway") {
    return "open-responses";
  }
  if (provider === "amazon-bedrock") {
    return "bedrock";
  }
  if (provider === "azure" || provider === "openai") {
    return "open-responses";
  }

  if (provider === null || !providerSupportsConnectTransportPicker(provider)) {
    return undefined;
  }

  return connectTransportKind;
}

export function connectTransportOptionSummary(
  option: ConnectTransportOption,
  _provider: DesktopModelProvider | null,
): string | undefined {
  return option.summaryKey ? i18n.t(option.summaryKey) : undefined;
}

export function resolveCustomConnectApiBase(customApiBase: string): string {
  return customApiBase.trim();
}

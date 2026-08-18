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

export function connectTransportOptionsForProvider(
  provider: DesktopModelProvider,
): ConnectTransportOption[] {
  switch (provider) {
    case "openai":
      return [];
    // Direct providers: the connection wizard fixes Chat Completions and does not expose an API type choice.
    case "xai":
    case "google":
    case "google-vertex-ai":
    case "deepseek":
    case "kimi-code":
    case "meituan":
    case "xiaomi":
    case "alibaba":
    case "stepfun":
      return [connectTransportOptionCatalog.chatCompletions];
    case "minimax":
      return [connectTransportOptionCatalog.messagesApi];
    // TokenHub documents two web-browsing capabilities: Chat web_search_options and Responses
    // web_search; measured: Chat injection has no effect, and Responses is only supported by a few
    // models such as hy3-preview, which does not match TokenHub's Chat Completions-dominated model
    // matrix, so only Chat Completions is kept.
    case "tencent-tokenhub":
    case "mistral":
    case "cohere":
    case "together-ai":
    case "groq":
    case "deepinfra":
    case "baseten":
      return [connectTransportOptionCatalog.chatCompletions];
    case "hugging-face":
      return [connectTransportOptionCatalog.openResponsesApi];
    case "siliconflow":
      return [
        connectTransportOptionCatalog.chatCompletions,
        connectTransportOptionCatalog.messagesApi,
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
    case "byteplus":
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
  if (provider === "azure" || provider === "openai" || provider === "deepseek") {
    return "open-responses";
  }

  return connectTransportOptionsForProvider(provider)[0]?.value ?? "openai-compatible";
}

export function providerSupportsConnectTransportPicker(
  provider: DesktopModelProvider | null,
): provider is DesktopModelProvider {
  return (
    provider === "siliconflow" ||
    provider === "custom" ||
    provider === "openrouter" ||
    provider === "cloudflare-ai-gateway" ||
    provider === "fireworks-ai" ||
    provider === "volcengine" ||
    provider === "byteplus"
  );
}

export function providerShowsConnectTransportPicker(
  provider: DesktopModelProvider | null,
): boolean {
  return (
    provider !== null &&
    provider !== "vercel-ai-gateway" &&
    providerSupportsConnectTransportPicker(provider)
  );
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

  if (provider === null) {
    return undefined;
  }

  if (!providerSupportsConnectTransportPicker(provider)) {
    return connectTransportKind;
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

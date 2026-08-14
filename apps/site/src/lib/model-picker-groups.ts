import type {
  DesktopModelCatalogHint,
  DesktopModelProvider,
  ModelProfileSnapshot,
} from "@/types/spirit-desktop";

const PROVIDER_ORDER: DesktopModelProvider[] = [
  "openai",
  "anthropic",
  "google",
  "vercel-ai-gateway",
  "deepseek",
  "openrouter",
  "custom",
];

const PROVIDER_LABELS: Record<DesktopModelProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  "vercel-ai-gateway": "Vercel AI Gateway",
  deepseek: "DeepSeek",
  openrouter: "OpenRouter",
  custom: "Custom",
};

function normalizeApiBase(apiBase: string): string {
  return apiBase.trim().replace(/\/+$/u, "").toLowerCase();
}

function catalogOrderIndex(
  name: string,
  apiBase: string,
  hints: DesktopModelCatalogHint[] | undefined,
): number {
  const normalizedBase = normalizeApiBase(apiBase);
  const hint = hints?.find((entry) => normalizeApiBase(entry.apiBase) === normalizedBase);
  if (!hint) {
    return 10_000;
  }
  const index = hint.modelIds.indexOf(name);
  return index === -1 ? 10_001 : index;
}

export type ModelPickerGroup = {
  provider: DesktopModelProvider;
  label: string;
  labelKey: string;
  fallbackLabel: string;
  items: ModelProfileSnapshot[];
};

export function groupModelsForPicker(
  models: ModelProfileSnapshot[],
  catalogHints: DesktopModelCatalogHint[] | undefined,
): ModelPickerGroup[] {
  const buckets = new Map<DesktopModelProvider, ModelProfileSnapshot[]>();

  for (const model of models) {
    const provider: DesktopModelProvider = model.provider ?? "custom";
    const list = buckets.get(provider) ?? [];
    list.push(model);
    buckets.set(provider, list);
  }

  const providers = [...buckets.keys()].sort((left, right) => {
    const leftIndex = PROVIDER_ORDER.indexOf(left);
    const rightIndex = PROVIDER_ORDER.indexOf(right);
    if (leftIndex !== rightIndex) {
      return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
    }
    return left.localeCompare(right);
  });

  return providers.map((provider) => {
    const items = (buckets.get(provider) ?? []).slice().sort((left, right) => {
      const leftOrder = catalogOrderIndex(left.name, left.apiBase, catalogHints);
      const rightOrder = catalogOrderIndex(right.name, right.apiBase, catalogHints);
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return left.name.localeCompare(right.name);
    });
    const label = PROVIDER_LABELS[provider];

    return {
      provider,
      label,
      labelKey: `providers.${provider}`,
      fallbackLabel: label,
      items,
    };
  });
}

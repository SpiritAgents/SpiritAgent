import type {
  DesktopModelCatalogHint,
  DesktopModelProvider,
  ModelProfileSnapshot,
  PreviewModelCatalogEntry,
  PreviewModelCatalogPricing,
} from '@/types';

const METADATA_PROVIDERS = new Set<DesktopModelProvider>(['vercel-ai-gateway', 'openrouter']);

/** 与 host-internal `normalizeOpenAiApiBase` 一致；勿从 host-internal 导入以免 renderer 拉入 node:fs。 */
function normalizeOpenAiApiBase(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

export function providerSupportsModelCatalogDetail(
  provider: DesktopModelProvider | undefined,
): boolean {
  return provider !== undefined && METADATA_PROVIDERS.has(provider);
}

export function modelCatalogHintKey(input: {
  provider?: DesktopModelProvider;
  transportKind?: ModelProfileSnapshot['transportKind'];
  apiBase: string;
}): string {
  const base = normalizeOpenAiApiBase(input.apiBase.trim() || '');
  return `${input.provider ?? 'custom'}::${input.transportKind ?? 'openai-compatible'}::${base}`;
}

export function modelHasCatalogDetail(entry: PreviewModelCatalogEntry | undefined): boolean {
  if (!entry) {
    return false;
  }
  if (entry.description?.trim()) {
    return true;
  }
  const pricing = entry.pricing;
  if (!pricing) {
    return false;
  }
  return Boolean(
    pricing.inputPerTokenUsd?.trim()
      || pricing.outputPerTokenUsd?.trim()
      || pricing.imagePerUnitUsd?.trim()
      || pricing.requestPerCallUsd?.trim(),
  );
}

export function buildModelCatalogDetailMap(
  models: readonly ModelProfileSnapshot[],
  hints: readonly DesktopModelCatalogHint[] | undefined,
): Map<string, PreviewModelCatalogEntry> {
  const hintByKey = new Map<string, DesktopModelCatalogHint>();
  for (const hint of hints ?? []) {
    hintByKey.set(
      modelCatalogHintKey({
        provider: hint.provider,
        transportKind: hint.transportKind,
        apiBase: hint.apiBase,
      }),
      hint,
    );
  }

  const detailByModelName = new Map<string, PreviewModelCatalogEntry>();
  for (const model of models) {
    if (!providerSupportsModelCatalogDetail(model.provider)) {
      continue;
    }
    const hint = hintByKey.get(
      modelCatalogHintKey({
        provider: model.provider,
        transportKind: model.transportKind,
        apiBase: model.apiBase,
      }),
    );
    const catalogEntry = hint?.modelCatalog?.find((entry) => entry.id === model.name);
    if (modelHasCatalogDetail(catalogEntry)) {
      detailByModelName.set(model.name, catalogEntry as PreviewModelCatalogEntry);
    }
  }

  return detailByModelName;
}

export function modelCatalogDisplayTitle(
  model: ModelProfileSnapshot,
  catalogEntry: PreviewModelCatalogEntry | undefined,
): string {
  const displayName = catalogEntry?.displayName?.trim();
  return displayName && displayName.length > 0 ? displayName : model.name;
}

type PricingLabelKey =
  | 'settings.modelDetailPricingInput'
  | 'settings.modelDetailPricingOutput'
  | 'settings.modelDetailPricingImage'
  | 'settings.modelDetailPricingRequest';

export function formatModelCatalogPricingLines(
  pricing: PreviewModelCatalogPricing | undefined,
  t: (key: PricingLabelKey, options?: { value: string }) => string,
): string[] {
  if (!pricing) {
    return [];
  }

  const lines: string[] = [];
  const input = formatUsdPerMillionTokens(pricing.inputPerTokenUsd);
  if (input) {
    lines.push(t('settings.modelDetailPricingInput', { value: input }));
  }
  const output = formatUsdPerMillionTokens(pricing.outputPerTokenUsd);
  if (output) {
    lines.push(t('settings.modelDetailPricingOutput', { value: output }));
  }
  const image = formatUsdFlatRate(pricing.imagePerUnitUsd);
  if (image) {
    lines.push(t('settings.modelDetailPricingImage', { value: image }));
  }
  const request = formatUsdFlatRate(pricing.requestPerCallUsd);
  if (request) {
    lines.push(t('settings.modelDetailPricingRequest', { value: request }));
  }
  return lines;
}

function formatUsdPerMillionTokens(value: string | undefined): string | undefined {
  const amount = parseUsdAmount(value);
  if (amount === undefined) {
    return undefined;
  }
  const perMillion = amount * 1_000_000;
  return formatUsd(perMillion);
}

function formatUsdFlatRate(value: string | undefined): string | undefined {
  const amount = parseUsdAmount(value);
  if (amount === undefined) {
    return undefined;
  }
  return formatUsd(amount);
}

function parseUsdAmount(value: string | undefined): number | undefined {
  if (!value?.trim()) {
    return undefined;
  }
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return parsed;
}

function formatUsd(amount: number): string {
  if (amount === 0) {
    return '$0';
  }
  const abs = Math.abs(amount);
  if (abs >= 1) {
    return `$${amount.toFixed(2)}`;
  }
  if (abs >= 0.01) {
    return `$${amount.toFixed(2)}`;
  }
  if (abs >= 0.0001) {
    return `$${amount.toFixed(4)}`;
  }
  return `$${amount.toExponential(2)}`;
}

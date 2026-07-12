import {
  MODEL_PROVIDER_PICKER_ORDER,
  PROVIDER_PICKER_ROWS,
  defaultPresetProviderGroupId,
} from "@spiritagent/host-internal";
import { normalizeOpenAiApiBase } from "@spiritagent/host-internal/openai-api-base";
import type {
  DesktopModelCatalogHint,
  DesktopModelProvider,
  DesktopTransportKind,
  ModelProfileSnapshot,
  ProviderGroupV2,
} from "@/types";

const PROVIDER_ORDER: DesktopModelProvider[] = [...MODEL_PROVIDER_PICKER_ORDER];

export function providerLabelMetadata(provider: DesktopModelProvider): { labelKey: string; fallbackLabel: string } {
  const row = PROVIDER_PICKER_ROWS.find((item) => item.id === provider);
  return row ? { labelKey: row.labelKey, fallbackLabel: row.fallbackLabel } : { labelKey: provider, fallbackLabel: provider };
}

function normalizeTransportKind(
  transportKind: DesktopTransportKind | undefined,
  provider?: DesktopModelProvider,
): DesktopTransportKind {
  if (transportKind) {
    return transportKind;
  }

  return provider === 'anthropic' ? 'anthropic' : 'openai-compatible';
}

function catalogOrderIndex(
  name: string,
  apiBase: string,
  transportKind: DesktopTransportKind,
  hints: DesktopModelCatalogHint[] | undefined,
): number {
  const normalizedBase = normalizeOpenAiApiBase(apiBase);
  const hint = hints?.find((h) =>
    normalizeOpenAiApiBase(h.apiBase) === normalizedBase
    && normalizeTransportKind(h.transportKind, h.provider) === transportKind,
  );
  if (!hint) {
    return 10_000;
  }
  const idx = hint.modelIds.indexOf(name);
  return idx === -1 ? 10_000 + 1 : idx;
}

export type ModelPickerGroup = {
  groupId: string;
  provider: DesktopModelProvider;
  labelKey: string;
  fallbackLabel: string;
  customLabel?: string;
  items: ModelProfileSnapshot[];
};

/**
 * 主界面模型下拉：按 provider group（groupId）分组；组内顺序优先对齐 `modelCatalogHints` 中的上游列表顺序。
 */
export function groupModelsForPicker(
  models: ModelProfileSnapshot[],
  catalogHints: DesktopModelCatalogHint[] | undefined,
  providerGroups?: readonly ProviderGroupV2[],
): ModelPickerGroup[] {
  const groupMeta = new Map(
    (providerGroups ?? []).map((group) => [group.id, group] as const),
  );
  const buckets = new Map<string, ModelProfileSnapshot[]>();
  for (const model of models) {
    const groupId =
      model.groupId
      ?? model.ref?.groupId
      ?? defaultPresetProviderGroupId(model.provider ?? "custom");
    const list = buckets.get(groupId) ?? [];
    list.push(model);
    buckets.set(groupId, list);
  }

  const keys = [...buckets.keys()].sort((leftId, rightId) => {
    const leftGroup = groupMeta.get(leftId);
    const rightGroup = groupMeta.get(rightId);
    const leftProvider = leftGroup?.provider ?? buckets.get(leftId)?.[0]?.provider ?? "custom";
    const rightProvider = rightGroup?.provider ?? buckets.get(rightId)?.[0]?.provider ?? "custom";
    const leftIndex = PROVIDER_ORDER.indexOf(leftProvider);
    const rightIndex = PROVIDER_ORDER.indexOf(rightProvider);
    if (leftIndex !== rightIndex) {
      return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
    }
    const leftLabel = leftGroup?.label?.trim() ?? leftId;
    const rightLabel = rightGroup?.label?.trim() ?? rightId;
    return leftLabel.localeCompare(rightLabel);
  });

  return keys.map((groupId) => {
    const meta = groupMeta.get(groupId);
    const provider = meta?.provider ?? buckets.get(groupId)?.[0]?.provider ?? "custom";
    const items = (buckets.get(groupId) ?? []).slice().sort((a, b) => {
      const filteredHints = catalogHints?.filter(
        (hint) => (hint.provider ?? "custom") === provider,
      );
      const aTransportKind = normalizeTransportKind(a.transportKind, a.provider);
      const bTransportKind = normalizeTransportKind(b.transportKind, b.provider);
      const orderA = catalogOrderIndex(a.name, a.apiBase, aTransportKind, filteredHints);
      const orderB = catalogOrderIndex(b.name, b.apiBase, bTransportKind, filteredHints);
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.name.localeCompare(b.name);
    });
    return {
      groupId,
      provider,
      customLabel: meta?.label?.trim() || undefined,
      ...providerLabelMetadata(provider),
      items,
    };
  });
}

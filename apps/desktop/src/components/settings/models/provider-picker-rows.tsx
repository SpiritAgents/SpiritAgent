import { ProviderIcon } from "@/components/provider-icon";
import { PROVIDER_PICKER_ROWS } from "@spiritagent/host-internal/model-provider-presets";
import type { DesktopModelProvider } from "@/types";

/** 兼容 react-i18next `t` 的最小签名，避免直接依赖 TFunction 泛型。 */
export type ProviderLabelTranslate = (
  key: string,
  options?: { defaultValue?: string },
) => string;

export type LocalizedProviderRow = {
  id: DesktopModelProvider;
  label: string;
};

export function providerPickerLabel(
  t: ProviderLabelTranslate,
  provider: DesktopModelProvider,
): string {
  const row = PROVIDER_PICKER_ROWS.find((item) => item.id === provider);
  return row ? String(t(row.labelKey, { defaultValue: row.fallbackLabel })) : provider;
}

export function localizedProviderRows(t: ProviderLabelTranslate): LocalizedProviderRow[] {
  return PROVIDER_PICKER_ROWS.map((row) => ({
    id: row.id,
    label: providerPickerLabel(t, row.id),
  }));
}

/** 按本地化显示名（大小写不敏感）实时过滤；空查询返回全量。 */
export function filterProviderRows(
  rows: LocalizedProviderRow[],
  query: string,
): LocalizedProviderRow[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return rows;
  }
  return rows.filter((row) => row.label.toLowerCase().includes(normalized));
}

/** 设置页 picker 与 OOBE 列表共用的 provider 行按钮。 */
export function ProviderPickerRowButton({
  row,
  onSelect,
}: {
  row: LocalizedProviderRow;
  onSelect: (id: DesktopModelProvider) => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
      onClick={() => onSelect(row.id)}
    >
      <ProviderIcon providerId={row.id} />
      <span className="min-w-0 flex-1 truncate">{row.label}</span>
    </button>
  );
}

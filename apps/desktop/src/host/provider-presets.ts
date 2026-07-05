/** 薄封装：预设提供商数据来自 `@spiritagent/host-internal`，避免 Desktop 与 CLI 分叉。 */
export {
  DEFAULT_CUSTOM_API_BASE,
  MODEL_PROVIDER_PICKER_ORDER,
  PROVIDER_PRESET_API_BASE,
  PROVIDER_PICKER_ROWS,
  defaultProviderConnectSite,
  isProviderConnectSiteId,
  listProviderConnectSiteOptions,
  providerSupportsSiteSelection,
  providerConnectSiteRequiresWorkspaceId,
  resolveConnectApiBase,
  resolveProviderConnectApiBase,
} from '@spiritagent/host-internal/model-provider-presets';
export type {
  ModelProviderId,
  ProviderConnectSiteId,
  ProviderModelTransportKind,
  ResolveProviderConnectApiBaseOptions,
} from '@spiritagent/host-internal/model-provider-presets';

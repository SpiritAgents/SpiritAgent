/** Thin wrapper: preset provider data comes from `@spiritagent/host-internal`, avoiding Desktop/CLI divergence. */
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
} from "@spiritagent/host-internal/model-provider-presets";
export type {
  ModelProviderId,
  ProviderConnectSiteId,
  ProviderModelTransportKind,
  ResolveProviderConnectApiBaseOptions,
} from "@spiritagent/host-internal/model-provider-presets";

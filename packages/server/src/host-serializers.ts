import type { JsonObject, JsonValue } from '@spiritagent/agent-core';

/**
 * Serializers mirroring the legacy host-bridge shapes — CLI/Desktop clients
 * already deserialize these exact field layouts.
 */

interface ExtensionToolContribution {
  name: string;
  description: string;
  inputSchema: unknown;
  outputSchema?: unknown;
  approvalMode?: string;
  executionMode?: string;
}

interface ExtensionManifestLike {
  name: string;
  icon?: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  main?: string;
  supportedHosts: Array<'cli' | 'desktop'>;
  activationEvents?: string[];
  requestedCapabilities?: string[];
  contributes?: {
    tools?: ExtensionToolContribution[];
    desktop?: { css?: Array<{ path: string; media?: string }> };
    cli?: {
      hooks?: Array<{
        slot: string;
        variant?: string;
        tokens?: { foreground?: string; border?: string; accent?: string };
        prefix?: string;
        suffix?: string;
      }>;
    };
  };
  settingsSchema?: Array<{
    key: string;
    type: string;
    title: string;
    description?: string;
    placeholder?: string;
    required?: boolean;
    defaultValue?: string | boolean | number;
    options?: Array<{ value: string; label: string; description?: string }>;
  }>;
  secretSlots?: Array<{
    key: string;
    title: string;
    description?: string;
    required?: boolean;
  }>;
}

function serializeExtensionContributes(item: ExtensionManifestLike['contributes']): JsonObject | Record<string, never> {
  if (!item) {
    return {};
  }
  const contributes = {
    ...(item.tools?.length
      ? {
          tools: item.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            ...(tool.approvalMode ? { approvalMode: tool.approvalMode } : {}),
            ...(tool.executionMode ? { executionMode: tool.executionMode } : {}),
          })),
        }
      : {}),
    ...(item.desktop?.css?.length
      ? {
          desktop: {
            css: item.desktop.css.map((entry) => ({
              path: entry.path,
              ...(entry.media ? { media: entry.media } : {}),
            })),
          },
        }
      : {}),
    ...(item.cli?.hooks?.length
      ? {
          cli: {
            hooks: item.cli.hooks.map((hook) => ({
              slot: hook.slot,
              ...(hook.variant ? { variant: hook.variant } : {}),
              ...(hook.tokens
                ? {
                    tokens: {
                      ...(hook.tokens.foreground ? { foreground: hook.tokens.foreground } : {}),
                      ...(hook.tokens.border ? { border: hook.tokens.border } : {}),
                      ...(hook.tokens.accent ? { accent: hook.tokens.accent } : {}),
                    },
                  }
                : {}),
              ...(hook.prefix ? { prefix: hook.prefix } : {}),
              ...(hook.suffix ? { suffix: hook.suffix } : {}),
            })),
          },
        }
      : {}),
  };
  return Object.keys(contributes).length > 0 ? { contributes } : {};
}

export function serializeHostExtension(item: {
  id: string;
  manifest: ExtensionManifestLike;
  installedAtUnixMs: number;
  archiveFileName?: string;
}): JsonObject {
  return {
    id: item.id,
    displayName: item.manifest.name,
    ...(item.manifest.icon ? { icon: item.manifest.icon } : {}),
    version: item.manifest.version,
    ...(item.manifest.description ? { description: item.manifest.description } : {}),
    ...(item.manifest.author ? { author: item.manifest.author } : {}),
    ...(item.manifest.homepage ? { homepage: item.manifest.homepage } : {}),
    ...(item.manifest.main ? { main: item.manifest.main } : {}),
    supportedHosts: [...item.manifest.supportedHosts],
    ...(item.manifest.activationEvents?.length
      ? { activationEvents: [...item.manifest.activationEvents] }
      : {}),
    ...(item.manifest.requestedCapabilities?.length
      ? { requestedCapabilities: [...item.manifest.requestedCapabilities] }
      : {}),
    ...serializeExtensionContributes(item.manifest.contributes),
    ...(item.manifest.settingsSchema?.length
      ? {
          settingsSchema: item.manifest.settingsSchema.map((setting) => ({
            key: setting.key,
            type: setting.type,
            title: setting.title,
            ...(setting.description ? { description: setting.description } : {}),
            ...(setting.placeholder ? { placeholder: setting.placeholder } : {}),
            ...(setting.required !== undefined ? { required: setting.required } : {}),
            ...(setting.defaultValue !== undefined ? { defaultValue: setting.defaultValue } : {}),
            ...(setting.options?.length
              ? {
                  options: setting.options.map((option) => ({
                    value: option.value,
                    label: option.label,
                    ...(option.description ? { description: option.description } : {}),
                  })),
                }
              : {}),
          })),
        }
      : {}),
    ...(item.manifest.secretSlots?.length
      ? {
          secretSlots: item.manifest.secretSlots.map((slot) => ({
            key: slot.key,
            title: slot.title,
            ...(slot.description ? { description: slot.description } : {}),
            ...(slot.required !== undefined ? { required: slot.required } : {}),
          })),
        }
      : {}),
    ...(item.archiveFileName ? { archiveFileName: item.archiveFileName } : {}),
    installedAtUnixMs: item.installedAtUnixMs,
  } as unknown as JsonObject;
}

interface MarketplaceCatalogItemLike {
  extensionId: string;
  packageName: string;
  status: string;
  featured: boolean;
  defaultVersion: string;
  defaultChannel: string;
  defaultReviewStatus: string;
  detailPath: string;
  displayName: string;
  description: string;
  author?: string;
  homepageUrl?: string;
  repositoryUrl?: string;
  keywords: string[];
  supportedHosts: string[];
  requestedCapabilities: string[];
  iconUrl?: string;
}

export function serializeMarketplaceCatalogItem(item: MarketplaceCatalogItemLike): JsonObject {
  return {
    extensionId: item.extensionId,
    packageName: item.packageName,
    status: item.status,
    featured: item.featured,
    defaultVersion: item.defaultVersion,
    defaultChannel: item.defaultChannel,
    defaultReviewStatus: item.defaultReviewStatus,
    detailPath: item.detailPath,
    displayName: item.displayName,
    description: item.description,
    ...(item.author ? { author: item.author } : {}),
    ...(item.homepageUrl ? { homepageUrl: item.homepageUrl } : {}),
    ...(item.repositoryUrl ? { repositoryUrl: item.repositoryUrl } : {}),
    keywords: [...item.keywords],
    supportedHosts: [...item.supportedHosts],
    requestedCapabilities: [...item.requestedCapabilities],
    ...(item.iconUrl ? { iconUrl: item.iconUrl } : {}),
  } as unknown as JsonObject;
}

interface MarketplaceVersionLike {
  version: string;
  channel: string;
  reviewStatus: string;
  displayName: string;
  description: string;
  author?: string;
  homepageUrl?: string;
  repositoryUrl?: string;
  keywords: string[];
  supportedHosts: string[];
  requestedCapabilities: string[];
  iconUrl?: string;
  publishedAt?: string;
  tarballUrl?: string;
  integrity?: string;
  shasum?: string;
  changelog?: { summary: string; body: string };
}

function serializeMarketplaceVersion(item: MarketplaceVersionLike): JsonObject {
  return {
    version: item.version,
    channel: item.channel,
    reviewStatus: item.reviewStatus,
    displayName: item.displayName,
    description: item.description,
    ...(item.author ? { author: item.author } : {}),
    ...(item.homepageUrl ? { homepageUrl: item.homepageUrl } : {}),
    ...(item.repositoryUrl ? { repositoryUrl: item.repositoryUrl } : {}),
    keywords: [...item.keywords],
    supportedHosts: [...item.supportedHosts],
    requestedCapabilities: [...item.requestedCapabilities],
    ...(item.iconUrl ? { iconUrl: item.iconUrl } : {}),
    ...(item.publishedAt ? { publishedAt: item.publishedAt } : {}),
    ...(item.tarballUrl ? { tarballUrl: item.tarballUrl } : {}),
    ...(item.integrity ? { integrity: item.integrity } : {}),
    ...(item.shasum ? { shasum: item.shasum } : {}),
    ...(item.changelog
      ? { changelog: { summary: item.changelog.summary, body: item.changelog.body } }
      : {}),
  } as unknown as JsonObject;
}

export function serializeMarketplaceDetail(detail: {
  extensionId: string;
  packageName: string;
  status: string;
  featured: boolean;
  defaultVersion: string;
  readmePath: string;
  versions: MarketplaceVersionLike[];
}): JsonObject {
  return {
    extensionId: detail.extensionId,
    packageName: detail.packageName,
    status: detail.status,
    featured: detail.featured,
    defaultVersion: detail.defaultVersion,
    readmePath: detail.readmePath,
    versions: detail.versions.map(serializeMarketplaceVersion),
  } as unknown as JsonObject;
}

export function serializeMarketplacePreparedInstall(item: {
  extensionId: string;
  packageName: string;
  displayName: string;
  description: string;
  version: string;
  channel: string;
  reviewStatus: string;
  supportedHosts: string[];
  supportsCurrentHost: boolean;
  tarballUrl?: string;
  integrity?: string;
  shasum?: string;
  sourceFileName: string;
  catalogItem: MarketplaceCatalogItemLike;
  detail: {
    extensionId: string;
    packageName: string;
    status: string;
    featured: boolean;
    defaultVersion: string;
    readmePath: string;
    versions: MarketplaceVersionLike[];
  };
}): JsonObject {
  return {
    extensionId: item.extensionId,
    packageName: item.packageName,
    displayName: item.displayName,
    description: item.description,
    version: item.version,
    channel: item.channel,
    reviewStatus: item.reviewStatus,
    supportedHosts: [...item.supportedHosts],
    supportsCurrentHost: item.supportsCurrentHost,
    ...(item.tarballUrl ? { tarballUrl: item.tarballUrl } : {}),
    ...(item.integrity ? { integrity: item.integrity } : {}),
    ...(item.shasum ? { shasum: item.shasum } : {}),
    sourceFileName: item.sourceFileName,
    catalogItem: serializeMarketplaceCatalogItem(item.catalogItem),
    detail: serializeMarketplaceDetail(item.detail),
  } as unknown as JsonObject;
}

export type { JsonValue };

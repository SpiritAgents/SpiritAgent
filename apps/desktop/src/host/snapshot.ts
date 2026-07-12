import type {
  ActiveSessionSnapshot,
  ConversationSnapshot,
  DesktopAutomationListItem,
  DesktopDreamCollectorSnapshot,
  DesktopExtensionCssLayer,
  DesktopExtensionListItem,
  DesktopHookListItem,
  DesktopGitSnapshot,
  DesktopMcpServerListItem,
  DesktopModelCatalogHint,
  DesktopSnapshot,
  McpStatusSnapshot,
} from '../types.js';
import { readModelCatalogCacheSync } from './model-catalog-cache.js';
import { flattenProviderGroups } from './model-config-access.js';
import {
  DEFAULT_API_BASE,
  normalizeAgentsConfig,
  normalizeWorkspaceBinding,
  type DesktopConfigFile,
  type HostMetadataSummary,
} from './storage.js';
import {
  buildAvailableWorkspaces,
  buildWebHostSnapshot,
} from './service-utils.js';
import { resolveDesktopHomeDirectory } from './storage.js';
import type { DesktopLspSnapshot } from '../types.js';

export interface BuildDesktopSnapshotInput {
  workspaceRoot: string;
  config: DesktopConfigFile;
  git: DesktopGitSnapshot;
  metadata: HostMetadataSummary;
  plan: DesktopSnapshot['plan'];
  extensionsList: DesktopExtensionListItem[];
  extensionCss: DesktopExtensionCssLayer[];
  extensionsLoading?: boolean;
  dreamCollectorStatus: DesktopDreamCollectorSnapshot;
  runtimeReady: boolean;
  runtimeError?: string;
  modelKeyPresence: Record<string, boolean>;
  activeApiKeyConfigured: boolean;
  mcpStatus: McpStatusSnapshot;
  mcpServers: DesktopMcpServerListItem[];
  hooksList: DesktopHookListItem[];
  lsp: DesktopLspSnapshot;
  conversation: ConversationSnapshot;
  activeSession?: ActiveSessionSnapshot;
  composerSessionKey: string;
  subagentViewer?: DesktopSnapshot['subagentViewer'];
  automationsList: DesktopAutomationListItem[];
  paneSessions?: DesktopSnapshot['paneSessions'];
}

function snapshotProviderGroups(config: DesktopConfigFile): DesktopConfigFile['providerGroups'] {
  return config.providerGroups.map((group) => ({
    ...group,
    models: group.models.map((model) => ({ ...model })),
  }));
}

export function buildDesktopSnapshot(input: BuildDesktopSnapshotInput): DesktopSnapshot {
  const flattenedModels = flattenProviderGroups(input.config);

  return {
    workspaceRoot: input.workspaceRoot,
    userHomeDirectory: resolveDesktopHomeDirectory(),
    workspaceBinding: normalizeWorkspaceBinding(input.config.workspaceBinding),
    availableWorkspaces: buildAvailableWorkspaces(
      input.workspaceRoot,
      input.config.recentWorkspaces,
      normalizeWorkspaceBinding(input.config.workspaceBinding),
    ),
    git: { ...input.git },
    dreams: {
      settings: {
        enabled: input.config.dreams.enabled === true,
        debugMode: input.config.dreams.debugMode === true,
      },
      collector: { ...input.dreamCollectorStatus },
    },
    runtimeReady: input.runtimeReady,
    ...(input.runtimeError ? { runtimeError: input.runtimeError } : {}),
    config: {
      providerGroups: snapshotProviderGroups(input.config),
      models: flattenedModels.map((model) => ({
        ...model,
        keyConfigured: input.modelKeyPresence[model.name] ?? false,
      })),
      activeModel: input.config.activeModel,
      ...(input.config.imageGenerationModel ? { imageGenerationModel: input.config.imageGenerationModel } : {}),
      ...(input.config.videoGenerationModel ? { videoGenerationModel: input.config.videoGenerationModel } : {}),
      ...(input.config.lightweightChatModel ? { lightweightChatModel: input.config.lightweightChatModel } : {}),
      ...(input.config.uiLocale ? { uiLocale: input.config.uiLocale } : {}),
      activeApiKeyConfigured: input.activeApiKeyConfigured,
      windowsMica: input.config.windowsMica !== false,
      systemNotifications: input.config.systemNotifications !== false,
      agentMode: input.config.agentMode ?? 'agent',
      modelCatalogHints: buildModelCatalogHints(input.config),
      networks: {
        llmHttpVersion: input.config.networks.llmHttpVersion,
      },
    },
    webHost: buildWebHostSnapshot(input.config.webHost),
    rules: {
      discovered: input.metadata.rules.discovered,
      enabled: input.metadata.rules.enabled,
    },
    skills: {
      discovered: input.metadata.skills.discovered,
      enabled: input.metadata.skills.enabled,
    },
    rulesList: input.metadata.rules.entries.map((entry) => ({
      id: entry.source.id,
      title: entry.source.title,
      shortLabel: entry.source.shortLabel,
      scope: entry.source.scope,
      rootKind: entry.source.rootKind,
      exists: entry.exists,
      enabled: entry.enabled,
      ...(entry.preview
        ? {
            previewExcerpt: entry.preview.excerpt,
            previewTruncated: entry.preview.truncated,
          }
        : {}),
    })),
    skillsList: input.metadata.skills.entries.map((entry) => ({
      id: entry.source.id,
      name: entry.source.name,
      description: entry.source.description,
      shortLabel: entry.source.shortLabel,
      scope: entry.source.scope,
      rootKind: entry.source.rootKind,
      enabled: entry.enabled,
    })),
    extensionsList: input.extensionsList.map((item) => ({ ...item })),
    extensionCss: input.extensionCss.map((entry) => ({ ...entry })),
    ...(input.extensionsLoading ? { extensionsLoading: true } : {}),
    plan: { ...input.plan },
    mcpStatus: input.mcpStatus,
    mcpServers: input.mcpServers,
    hooksList: input.hooksList,
    lsp: input.lsp,
    codeCompletion: {
      userEnabled: normalizeAgentsConfig(input.config.agents).codeCompletion.enabled,
    },
    conversation: input.conversation,
    ...(input.paneSessions ? { paneSessions: input.paneSessions } : {}),
    ...(input.activeSession ? { activeSession: { ...input.activeSession } } : {}),
    composerSessionKey: input.composerSessionKey,
    ...(input.subagentViewer ? { subagentViewer: input.subagentViewer } : {}),
    automationsList: input.automationsList.map((item) => ({ ...item })),
  };
}

/** buildSnapshot / 上下文用量高频调用；目录缓存文件只在 writeModelCatalogCache 后变化，按模型键集合做内存缓存。 */
let modelCatalogHintsMemo: { key: string; hints: DesktopModelCatalogHint[] } | undefined;

export function invalidateModelCatalogHintsMemo(): void {
  modelCatalogHintsMemo = undefined;
}

export function buildModelCatalogHints(config: DesktopConfigFile): DesktopModelCatalogHint[] {
  const seen = new Set<string>();
  for (const group of config.providerGroups) {
    const base = group.apiBase.trim() || DEFAULT_API_BASE;
    const transportKind = group.transportKind ?? (group.provider === 'anthropic' ? 'anthropic' : 'openai-compatible');
    seen.add(`${group.provider ?? 'custom'}::${transportKind}::${base}`);
  }
  const memoKey = [...seen].join('\n');
  if (modelCatalogHintsMemo?.key === memoKey) {
    return modelCatalogHintsMemo.hints;
  }
  const hints: DesktopModelCatalogHint[] = [];
  for (const group of config.providerGroups) {
    const base = group.apiBase.trim() || DEFAULT_API_BASE;
    const transportKind = group.transportKind ?? (group.provider === 'anthropic' ? 'anthropic' : 'openai-compatible');
    const cacheKey = `${group.provider ?? 'custom'}::${transportKind}::${base}`;
    if (!seen.delete(cacheKey)) {
      continue;
    }
    const hit = readModelCatalogCacheSync(base, group.provider, transportKind);
    if (hit && hit.modelIds.length > 0) {
      hints.push({
        ...(hit.provider ? { provider: hit.provider } : {}),
        ...(hit.transportKind ? { transportKind: hit.transportKind } : {}),
        apiBase: hit.apiBase,
        modelIds: hit.modelIds,
        ...(hit.modelCatalog ? { modelCatalog: hit.modelCatalog } : {}),
        fetchedAtUnixMs: hit.fetchedAtUnixMs,
      });
    }
  }
  modelCatalogHintsMemo = { key: memoKey, hints };
  return hints;
}

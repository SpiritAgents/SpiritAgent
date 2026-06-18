import {
  buildDreamReadHostToolDefinitions,
  type LlmExtensionSystemPrompt,
  type LlmToolAgentBasicInfo,
  type LlmTransportConfig,
} from '@spirit-agent/core';
import { generateWorktreeNamesFromTask } from '@spirit-agent/host-internal';

import i18n from '../lib/i18n-host.js';
import { resolveDesktopAgentMode } from '../lib/agent-mode.js';
import type { ModelProfileSnapshot } from '../types.js';
import { currentApiBase } from './service-utils.js';
import type { DesktopConfigFile, HostMetadataSummary } from './storage.js';
import { buildPrimaryTransportConfig } from './model-config.js';
import { buildDreamContextText } from './dreams.js';
import type { DesktopToolExecutor } from './tool-executor.js';
import type { GeneratedWorktreeNames } from './worktree-naming.js';

interface BackgroundLlmTaskContext {
  workspaceRoot: string;
  gitBranch?: string;
  config: DesktopConfigFile;
  taskModel: string;
  taskProfile?: ModelProfileSnapshot;
  apiKey: string;
  metadata: HostMetadataSummary;
  extensionSystemPrompts: LlmExtensionSystemPrompt[];
  toolExecutor: DesktopToolExecutor;
  runtimeBasicInfo: LlmToolAgentBasicInfo;
}

export async function generateWorktreeNamesFromModelTask(
  context: BackgroundLlmTaskContext & {
    userPrompt: string;
    baseBranch: string;
    repoRoot: string;
  },
): Promise<GeneratedWorktreeNames> {
  const transportConfig = buildTaskTransportConfig(context);
  const dreamContextText = await buildDreamContextText({
    workspaceRoot: context.workspaceRoot,
    gitBranch: context.gitBranch,
  });
  return generateWorktreeNamesFromTask({
    transport: transportConfig,
    task: context.userPrompt,
    baseBranch: context.baseBranch,
    repoRoot: context.repoRoot,
    workspaceRoot: context.workspaceRoot,
    toolExecutor: context.toolExecutor,
    enabledRules: context.metadata.rules.enabledRules,
    enabledSkillCatalog: context.metadata.skills.enabledSkillCatalog,
    extensionSystemPrompts: context.extensionSystemPrompts,
    planMetadata: context.metadata.planMetadata,
    runtimeBasicInfo: context.runtimeBasicInfo,
    ...(dreamContextText ? { dreamContextText } : {}),
    extraToolDefinitions: context.gitBranch ? buildDreamReadHostToolDefinitions() : [],
    errorMessages: {
      failurePrefix: (error) => i18n.t('error.autoWorktreeNameFailed', { error }),
      noBody: i18n.t('error.autoWorktreeNameFailedNoBody'),
      interactiveTool: (name) => i18n.t('error.autoWorktreeNameFailedInteractiveTool', { name }),
      incomplete: i18n.t('error.autoWorktreeNameFailedIncomplete'),
    },
  });
}

function buildTaskTransportConfig(context: BackgroundLlmTaskContext): LlmTransportConfig {
  return buildPrimaryTransportConfig({
    apiKey: context.apiKey,
    model: context.taskModel,
    baseUrl: currentApiBase(context.config),
    workspaceRoot: context.workspaceRoot,
    profile: context.taskProfile,
    agentMode: resolveDesktopAgentMode(context.config),
  });
}

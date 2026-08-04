import path from 'node:path';

import {
  createLlmTransport,
  type ChatArchive,
  type LlmPlanMetadata,
  type LlmTransportConfig,
} from '@spiritagent/agent-core';
import {
  normalizeApprovalLevel,
  type HostAutomationDefinition,
} from '@spiritagent/host-internal';

import { buildDesktopRuntimeBasicInfo, createDesktopRuntime, type DesktopRuntime } from './runtime.js';
import {
  closeRemoteDesktopRuntime,
  createRemoteDesktopRuntime,
  desktopUsesDaemonRuntime,
} from './remote-runtime.js';
import { DesktopToolExecutor } from './tool-executor.js';
import {
  loadHostMetadata,
  normalizeAgentsConfig,
  spiritAgentDataDir,
  type DesktopConfigFile,
} from './storage.js';

export interface CreateAutomationRuntimeInput {
  definition: HostAutomationDefinition;
  config: DesktopConfigFile;
  sessionPath: string;
  gitBranchLabel?: string;
  transportConfig?: LlmTransportConfig;
  planMetadata?: LlmPlanMetadata;
  metadata?: Awaited<ReturnType<typeof loadHostMetadata>>;
  toolExecutor?: DesktopToolExecutor;
}

export interface AutomationRuntimeHandle {
  runtime: DesktopRuntime;
  dispose: () => Promise<void>;
}

export function buildEmptyAutomationArchive(
  approvalLevel: HostAutomationDefinition['approvalLevel'],
): ChatArchive {
  return {
    messages: [],
    assistantAux: [],
    llmHistory: [],
    subagentSessions: [],
    loopEnabled: false,
    approvalLevel: normalizeApprovalLevel(approvalLevel),
  };
}

export async function createAutomationRuntime(
  input: CreateAutomationRuntimeInput,
): Promise<AutomationRuntimeHandle> {
  if (desktopUsesDaemonRuntime()) {
    return createDaemonAutomationRuntime(input);
  }
  return createInProcessAutomationRuntime(input);
}

export async function disposeAutomationRuntime(handle: AutomationRuntimeHandle): Promise<void> {
  await handle.dispose();
}

async function createDaemonAutomationRuntime(
  input: CreateAutomationRuntimeInput,
): Promise<AutomationRuntimeHandle> {
  const conversationKey = path.resolve(input.sessionPath);
  const approvalLevel = normalizeApprovalLevel(input.definition.approvalLevel);

  const runtime = await createRemoteDesktopRuntime({
    dataDir: spiritAgentDataDir(),
    workspaceRoot: input.definition.workspaceRoot,
    modelRef: input.definition.modelRef,
    agentMode: 'agent',
    archive: buildEmptyAutomationArchive(input.definition.approvalLevel),
    approvalLevel,
    todoSessionKey: conversationKey,
    conversationKey,
  });

  return {
    runtime,
    dispose: async () => {
      await closeRemoteDesktopRuntime(runtime);
    },
  };
}

async function createInProcessAutomationRuntime(
  input: CreateAutomationRuntimeInput,
): Promise<AutomationRuntimeHandle> {
  if (!input.transportConfig || !input.planMetadata || !input.metadata || !input.toolExecutor) {
    throw new Error('In-process automation runtime requires transport, metadata, and tool executor.');
  }

  const agents = normalizeAgentsConfig(input.config.agents);
  const runtime = createDesktopRuntime({
    transportConfig: input.transportConfig,
    history: [],
    enabledRules: input.metadata.rules.enabledRules,
    enabledSkillCatalog: input.metadata.skills.enabledSkillCatalog,
    planMetadata: input.planMetadata,
    extensionSystemPrompts: [],
    toolExecutor: input.toolExecutor,
    llmTransport: createLlmTransport(input.transportConfig),
    workspaceRoot: input.definition.workspaceRoot,
    basicInfo: buildDesktopRuntimeBasicInfo(
      input.definition.workspaceRoot,
      input.toolExecutor,
      input.gitBranchLabel,
    ),
    attribution: {
      commitEnabled: agents.attribution.commit.enabled,
      prEnabled: agents.attribution.pr.enabled,
    },
  });

  return {
    runtime,
    dispose: async () => {},
  };
}

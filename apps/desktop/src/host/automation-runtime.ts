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
  replyRemoteWorkspaceCapabilityTrust,
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
  consumeTrustBlocked: () => boolean;
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

export function buildAutomationRemoteRuntimeCreateInput(
  input: CreateAutomationRuntimeInput,
): {
  dataDir: string;
  workspaceRoot: string;
  modelRef: HostAutomationDefinition['modelRef'];
  agentMode: 'agent';
  archive: ChatArchive;
  approvalLevel: ReturnType<typeof normalizeApprovalLevel>;
  todoSessionKey: string;
  conversationKey: string;
} {
  const conversationKey = path.resolve(input.sessionPath);
  return {
    dataDir: spiritAgentDataDir(),
    workspaceRoot: input.definition.workspaceRoot,
    modelRef: input.definition.modelRef,
    agentMode: 'agent',
    archive: buildEmptyAutomationArchive(input.definition.approvalLevel),
    approvalLevel: normalizeApprovalLevel(input.definition.approvalLevel),
    todoSessionKey: conversationKey,
    conversationKey,
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
  let trustBlocked = false;
  let runtime: DesktopRuntime | undefined;

  runtime = await createRemoteDesktopRuntime({
    ...buildAutomationRemoteRuntimeCreateInput(input),
    onWorkspaceCapabilityTrustRequested: (requestId, request) => {
      void handleAutomationWorkspaceCapabilityTrust(
        () => runtime,
        requestId,
        input.definition.approvalLevel,
        () => {
          trustBlocked = true;
        },
      );
      void request;
    },
  });

  return {
    runtime,
    dispose: async () => {
      await closeRemoteDesktopRuntime(runtime);
    },
    consumeTrustBlocked: () => {
      if (!trustBlocked) {
        return false;
      }
      trustBlocked = false;
      return true;
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
    consumeTrustBlocked: () => false,
  };
}

async function handleAutomationWorkspaceCapabilityTrust(
  runtimeRef: () => DesktopRuntime | undefined,
  requestId: string,
  approvalLevel: HostAutomationDefinition['approvalLevel'],
  markBlocked: () => void,
): Promise<void> {
  const runtime = runtimeRef();
  if (!runtime) {
    return;
  }
  if (approvalLevel === 'full-approval' || approvalLevel === 'auto-approval') {
    await replyRemoteWorkspaceCapabilityTrust(runtime, requestId, 'allowOnce');
    return;
  }
  markBlocked();
  await replyRemoteWorkspaceCapabilityTrust(runtime, requestId, 'deny');
}

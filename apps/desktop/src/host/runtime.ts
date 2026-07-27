import {
  AgentRuntime,
  assistantToolCallMessageFromLlmState,
  finalAssistantHistoryMessageFromLlmState,
  appendLlmToolResultMessage,
  appendLlmUserLlmMessage,
  appendLlmUserMessage,
  buildApplyPatchFileToolsPromptSection,
  buildProviderWebSearchPromptSection,
  continueLlmToolAgentState,
  extractLastLlmAssistantText,
  normalizeStoredLlmMessage,
  rebuildLlmToolAgentStateAfterCompaction,
  shouldUseApplyPatchFileTools,
  startLlmToolAgentState,
  truncateLlmHistoryForCompaction,
  truncateLlmToolAgentStateForContextRetry,
  type ChatArchive,
  type HookRunner,
  type HookSessionContext,
  type LlmActiveSkill,
  type LlmEnabledRule,
  type LlmEnabledSkillCatalogEntry,
  type LlmExtensionSystemPrompt,
  type LlmPlanMetadata,
  type ToolAgentMcpToolCatalogSnapshot,
  type LlmToolAgentBasicInfo,
  type LlmToolAgentState,
  type LlmTransportConfig,
  type SpiritLlmTransport,
  type SubagentWorkspaceBootstrap,
  type ToolAutoReviewer,
  type SessionApprovalLevel,
} from '@spiritagent/agent-core';
import {
  persistSessionTranscript,
  persistSubagentTranscript,
  persistToolOutputArchive,
  resolveSubagentTranscriptFilePath,
  resolveTranscriptSessionDir,
} from '@spiritagent/host-internal';

import type { DesktopToolRequest } from './contracts.js';
import { spiritAgentDataDir } from './storage.js';
import type { DesktopToolExecutor } from './tool-executor.js';

export type DesktopRuntime = AgentRuntime<
  LlmTransportConfig,
  LlmToolAgentState,
  DesktopToolRequest,
  string
>;

export function createDesktopRuntime(input: {
  transportConfig: LlmTransportConfig;
  history: ChatArchive['llmHistory'];
  enabledRules: LlmEnabledRule[];
  enabledSkillCatalog: LlmEnabledSkillCatalogEntry[];
  mcpToolCatalog?: ToolAgentMcpToolCatalogSnapshot;
  planMetadata: LlmPlanMetadata;
  extensionSystemPrompts: LlmExtensionSystemPrompt[];
  dreamsContextText?: string;
  toolExecutor: DesktopToolExecutor;
  llmTransport: SpiritLlmTransport;
  workspaceRoot: string;
  basicInfo: LlmToolAgentBasicInfo;
  getLoopEnabled?: () => boolean;
  hookRunner?: HookRunner;
  hookSessionContext?: HookSessionContext;
  bootstrapSubagentWorkspace?: SubagentWorkspaceBootstrap<DesktopToolRequest, string>;
  getApprovalLevel?: () => SessionApprovalLevel;
  reviewToolApproval?: ToolAutoReviewer;
  flushPendingHostEvents?: () => void | Promise<void>;
}): DesktopRuntime {
  const resolveLoopEnabled = () => input.getLoopEnabled?.() === true;
  const applyPatchFileToolsPromptSection = resolveApplyPatchFileToolsPromptSection(
    input.transportConfig,
    input.planMetadata,
  );
  const providerWebSearchPromptSection = resolveProviderWebSearchPromptSection(
    input.transportConfig,
  );

  return new AgentRuntime<
    LlmTransportConfig,
    LlmToolAgentState,
    DesktopToolRequest,
    string
  >({
    config: input.transportConfig,
    llmTransport: input.llmTransport,
    toolExecutor: input.toolExecutor,
    createToolAgentState: (messages, userInput) =>
      startLlmToolAgentState(
        messages,
        userInput,
        input.workspaceRoot,
        input.enabledRules,
        input.enabledSkillCatalog,
        input.transportConfig.model,
        input.planMetadata,
        input.extensionSystemPrompts,
        input.dreamsContextText,
        input.basicInfo,
        applyPatchFileToolsPromptSection,
        providerWebSearchPromptSection,
        resolveLoopEnabled(),
        input.mcpToolCatalog,
      ),
    createContinuationState: (messages) =>
      continueLlmToolAgentState(
        messages,
        input.workspaceRoot,
        input.enabledRules,
        input.enabledSkillCatalog,
        input.transportConfig.model,
        input.planMetadata,
        input.extensionSystemPrompts,
        input.dreamsContextText,
        input.basicInfo,
        applyPatchFileToolsPromptSection,
        providerWebSearchPromptSection,
        resolveLoopEnabled(),
        input.mcpToolCatalog,
      ),
    appendToolResultMessage: appendLlmToolResultMessage,
    assistantToolCallMessageFromState: assistantToolCallMessageFromLlmState,
    finalAssistantHistoryMessageFromState: finalAssistantHistoryMessageFromLlmState,
    appendUserMessage: appendLlmUserMessage,
    appendUserLlmMessage: (state, message) => appendLlmUserLlmMessage(state, message, input.workspaceRoot),
    extractAssistantText: extractLastLlmAssistantText,
    truncateStateForContextRetry: truncateLlmToolAgentStateForContextRetry,
    truncateHistoryForCompaction: truncateLlmHistoryForCompaction,
    rebuildRetryStateAfterCompaction: (messages, userInput, retryState) =>
      rebuildLlmToolAgentStateAfterCompaction(
        messages,
        userInput,
        retryState,
        input.workspaceRoot,
        input.enabledRules,
        input.enabledSkillCatalog,
        input.transportConfig.model,
        input.planMetadata,
        input.extensionSystemPrompts,
        input.dreamsContextText,
        input.basicInfo,
        applyPatchFileToolsPromptSection,
        providerWebSearchPromptSection,
        resolveLoopEnabled(),
        input.mcpToolCatalog,
      ),
    resolveWorkspaceFilesFromInput: async () => [],
    generateImage: (request) =>
      input.llmTransport.generateImage(
        input.transportConfig,
        request,
        (saveRequest) => input.toolExecutor.saveGeneratedImage(saveRequest),
      ),
    generateVideo: (request) =>
      input.llmTransport.generateVideo(
        input.transportConfig,
        request,
        (saveRequest) => input.toolExecutor.saveGeneratedVideo(saveRequest),
      ),
    ...(input.hookRunner ? { hookRunner: input.hookRunner } : {}),
    ...(input.hookSessionContext ? { hookSessionContext: input.hookSessionContext } : {}),
    ...(input.bootstrapSubagentWorkspace
      ? { bootstrapSubagentWorkspace: input.bootstrapSubagentWorkspace }
      : {}),
    ...(input.getApprovalLevel ? { getApprovalLevel: input.getApprovalLevel } : {}),
    ...(input.reviewToolApproval ? { reviewToolApproval: input.reviewToolApproval } : {}),
    ...(input.flushPendingHostEvents ? { flushPendingHostEvents: input.flushPendingHostEvents } : {}),
    syncSessionTranscript: async ({ transcript, sessionKey }) =>
      persistSessionTranscript(spiritAgentDataDir(), transcript, {
        ...(sessionKey !== undefined ? { sessionKey } : {}),
      }),
    syncSubagentTranscript: async ({ transcript, sessionKey, subagentSessionId }) => {
      await persistSubagentTranscript(spiritAgentDataDir(), transcript, {
        subagentSessionId,
        ...(sessionKey !== undefined ? { sessionKey } : {}),
      });
    },
    resolveSubagentTranscriptPath: ({ sessionKey, subagentSessionId }) =>
      resolveSubagentTranscriptFilePath(spiritAgentDataDir(), sessionKey, subagentSessionId),
    persistToolOutputArchive: async (input) =>
      persistToolOutputArchive(spiritAgentDataDir(), input),
  }, input.history.map((message) => normalizeStoredLlmMessage(message)));
}

export function buildDesktopRuntimeBasicInfo(
  workspaceRoot: string,
  toolExecutor: DesktopToolExecutor,
  gitBranch?: string,
  sessionKey?: string,
): LlmToolAgentBasicInfo {
  const shell = toolExecutor.toolDefinitionEnvironment();
  const normalizedGitBranch = gitBranch?.trim();
  const normalizedSessionKey = sessionKey?.trim();
  const sessionTranscript = normalizedSessionKey
    ? resolveTranscriptSessionDir(spiritAgentDataDir(), normalizedSessionKey)
    : undefined;
  return {
    workspaceRoot,
    ...(normalizedGitBranch ? { gitBranch: normalizedGitBranch } : {}),
    ...(sessionTranscript ? { sessionTranscript } : {}),
    terminal: shell.shellDisplayName,
    system: toolExecutor.operatingSystemInfo(),
  };
}

export function cloneActiveSkills(skills: LlmActiveSkill[]): LlmActiveSkill[] {
  return skills.map((skill) => ({
    ...skill,
    resources: skill.resources.map((resource) => ({ ...resource })),
  }));
}

function resolveApplyPatchFileToolsPromptSection(
  config: LlmTransportConfig,
  planMetadata: LlmPlanMetadata,
): string | undefined {
  const agentMode = planMetadata.agentMode ?? 'agent';
  return config.transportKind === 'open-responses' && shouldUseApplyPatchFileTools(config, { agentMode })
    ? buildApplyPatchFileToolsPromptSection()
    : undefined;
}

function resolveProviderWebSearchPromptSection(
  config: LlmTransportConfig,
): string | undefined {
  return buildProviderWebSearchPromptSection(config);
}
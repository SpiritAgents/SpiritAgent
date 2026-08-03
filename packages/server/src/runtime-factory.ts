import { release as osRelease } from 'node:os';

import {
  AgentRuntime,
  McpService,
  buildApplyPatchFileToolsPromptSection,
  buildContributedHostToolDefinitions,
  buildProviderWebSearchPromptSection,
  buildTodoHostToolDefinitions,
  createLlmTransport,
  pendingWorkspaceFilesFromInput,
  type ContributedHostToolDefinition,
  type GeneratedImageSaveRequest,
  type JsonValue,
  type LlmMessage,
  type LlmTransportConfig,
  type RuntimeEvent,
  type SpiritAgentMode,
} from '@spiritagent/agent-core';
import {
  appendLlmToolResultMessage,
  appendLlmUserLlmMessage,
  appendLlmUserMessage,
  assistantToolCallMessageFromLlmState,
  continueLlmToolAgentState,
  extractLastLlmAssistantText,
  finalAssistantHistoryMessageFromLlmState,
  rebuildLlmToolAgentStateAfterCompaction,
  startLlmToolAgentState,
  truncateLlmHistoryForCompaction,
  truncateLlmToolAgentStateForContextRetry,
  type LlmActiveSkill,
  type LlmEnabledRule,
  type LlmEnabledSkillCatalogEntry,
  type LlmExtensionSystemPrompt,
  type LlmPlanMetadata,
  type LlmToolAgentBasicInfo,
  type LlmToolAgentState,
} from '@spiritagent/agent-core';
import {
  HostToolExecutorProxy,
  createCliAutoApprovalReviewer,
  type LocalHostToolService,
  type LspHostBindings,
} from '@spiritagent/agent-core/host-bridge';
import {
  LspService,
  NodeHostToolService,
  appendLspDiagnosticsAfterWriteIfNeeded,
  collectHostExtensionContributedTools,
  createHostExtensionManager,
  createHookRunner,
  createNoopMcpAdapter,
  ensureBuiltinAuthoringSkills,
  ensureTranscriptSessionDir,
  loadHostInstructionMetadata,
  persistSessionTranscript,
  persistSubagentTranscript,
  persistToolOutputArchive,
  readGitBranchLabelForBasicInfo,
  resolveSubagentTranscriptFilePath,
  resolveTranscriptSessionDir,
  resolveTransportConfig,
  type ApprovalLevel,
} from '@spiritagent/host-internal';

import { createNoopPeer } from './noop-peer.js';

export type ServerHostRuntime = AgentRuntime<LlmTransportConfig, LlmToolAgentState, JsonValue, JsonValue>;

export type ServerClientKind = 'cli' | 'desktop' | 'web';

export interface ServerRuntimeOptions {
  workspaceRoot: string;
  spiritDataDir: string;
  /** Transcript + todo scope key; defaults to the session id. */
  sessionKey: string;
  /** Extensions/todo surfaces differ per host; a session inherits its creator's kind. */
  hostKind: 'cli' | 'desktop';
  approvalLevel: ApprovalLevel;
  onEvent: (event: RuntimeEvent<JsonValue>) => void;
  /**
   * Workspace capability trust prompt (hooks). The session manager routes this
   * to connected clients; when no client can answer, the caller's fallback
   * applies (Phase 2: deny).
   */
  requestWorkspaceCapabilityTrust?: (request: {
    workspaceRoot: string;
    contentHash: string;
    hashChanged: boolean;
    hooks: Array<{ event: string; command: string; resolvedPath: string }>;
  }) => Promise<'allowOnce' | 'deny' | 'alwaysTrust'>;
  log?: (message: string) => void;
}

export interface ServerRuntimeResult {
  runtime: ServerHostRuntime;
  toolExecutor: HostToolExecutorProxy;
  mcpService: McpService;
  transportConfig: LlmTransportConfig;
  enabledRules: LlmEnabledRule[];
  enabledSkillCatalog: LlmEnabledSkillCatalogEntry[];
  /** Mutable array reference — turn handlers read it, slash activation mutates it. */
  activeSkills: LlmActiveSkill[];
  setAgentMode: (mode: SpiritAgentMode) => Promise<void>;
  setApprovalLevel: (level: ApprovalLevel) => void;
}

/**
 * Assembles a fully-wired AgentRuntime for the daemon. Supersedes the three
 * historical assembly sites (Desktop host service, CLI host-bridge sidecar,
 * acp-server runtime-factory): the daemon runs tools in-process via
 * NodeHostToolService, with a real per-session McpService, LSP bindings,
 * extensions, todos, hooks, and transcript persistence.
 */
export async function createServerRuntime(
  options: ServerRuntimeOptions,
): Promise<ServerRuntimeResult> {
  const {
    workspaceRoot,
    spiritDataDir,
    sessionKey,
    hostKind,
    onEvent,
  } = options;
  const log = options.log ?? (() => {});
  const approvalLevel = options.approvalLevel;

  const transportConfig = resolveTransportConfig({ workspaceRoot, spiritDataDir });
  await ensureTranscriptSessionDir(spiritDataDir, sessionKey);

  // 1. Tool executor: noop peer (no stdio peer in the daemon) + per-session MCP.
  const mcpService = new McpService(workspaceRoot, true);
  const toolExecutor = new HostToolExecutorProxy(createNoopPeer(), mcpService);
  mcpService.startBackgroundRefreshInBackground(false);

  // 2. Local tool service: real shell/file/web execution, noop management MCP
  //    adapter (MCP tool execution lives on the executor's McpService, same
  //    split as Desktop), extensions, todos, approval level.
  await ensureBuiltinAuthoringSkills(spiritDataDir);
  const extensionManager = createHostExtensionManager({ spiritDataDir, hostKind });
  let currentApprovalLevel = approvalLevel;
  const service = new NodeHostToolService(
    { workspaceRoot, spiritDataDir },
    {
      mcp: createNoopMcpAdapter(),
      extensions: {
        manager: extensionManager,
        getHost: () => ({}),
        logger: console,
      },
      fileChangeObserver: {
        async recordFileChange(change: unknown): Promise<void> {
          await toolExecutor.lspServiceSnapshot()?.syncFromRecordedChange(change);
        },
      },
      getApprovalLevel: () => currentApprovalLevel,
      todoScope: { sessionKey },
    },
  );
  toolExecutor.setLocalHostService(service as unknown as LocalHostToolService);
  toolExecutor.setTransportConfigForToolDefinitions(transportConfig);
  toolExecutor.setApprovalLevel(currentApprovalLevel);
  toolExecutor.setTodoToolDefinitions(buildTodoHostToolDefinitions());
  // The bridge passes these via a loosely-typed dynamic import; with static
  // imports the nominal types diverge slightly (structurally compatible).
  toolExecutor.setLspHostBindings({
    LspService,
    appendLspDiagnosticsAfterWriteIfNeeded,
  } as unknown as LspHostBindings);
  await toolExecutor.setLspWorkspaceRoot(workspaceRoot);

  // Extension-contributed tools + system prompts (host-scoped).
  const installedExtensions = await extensionManager.list();
  toolExecutor.setExtensionToolDefinitions(
    buildContributedHostToolDefinitions(
      collectHostExtensionContributedTools(installedExtensions) as unknown as ContributedHostToolDefinition[],
    ),
  );
  const extensionSystemPrompts: LlmExtensionSystemPrompt[] = (
    await extensionManager.collectSystemPromptContributions({ host: {}, logger: console })
  ).map((entry) => ({
    extensionId: entry.extensionId,
    extensionName: entry.extensionName,
    content: entry.content,
  }));

  await toolExecutor.refreshCaches();

  // 3. Rules / skills / plan metadata.
  const metadata = await loadHostInstructionMetadata(
    { workspaceRoot, spiritDataDir },
    { planMode: false, agentMode: 'agent' },
  );
  const enabledRules: LlmEnabledRule[] = [...metadata.rules.enabledRules];
  const enabledSkillCatalog: LlmEnabledSkillCatalogEntry[] = [...metadata.skills.enabledSkillCatalog];
  let currentPlanMetadata: LlmPlanMetadata | undefined = metadata.planMetadata;
  toolExecutor.setAgentModeToolExposure('agent');

  // 4. Basic info block.
  const shell = service.toolDefinitionEnvironment();
  const basicInfo: LlmToolAgentBasicInfo = {
    workspaceRoot,
    ...(shell?.shellDisplayName ? { terminal: shell.shellDisplayName } : {}),
    gitBranch: await readGitBranchLabelForBasicInfo(workspaceRoot),
    sessionTranscript: resolveTranscriptSessionDir(spiritDataDir, sessionKey),
    system: service.operatingSystemInfo?.() ?? {
      name: process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : process.platform === 'linux' ? 'Linux' : process.platform,
      version: osRelease(),
    },
  };

  // 5. Prompt sections.
  const applyPatchPromptSection = transportConfig.transportKind === 'open-responses'
    ? buildApplyPatchFileToolsPromptSection()
    : undefined;
  const providerWebSearchPromptSection = buildProviderWebSearchPromptSection(transportConfig);

  const activeSkills: LlmActiveSkill[] = [];
  const loopEnabled = false;
  const attribution = undefined;

  const createToolAgentState = (messages: LlmMessage[], userInput: string) =>
    startLlmToolAgentState(
      messages,
      userInput,
      workspaceRoot,
      enabledRules,
      enabledSkillCatalog,
      transportConfig.model,
      currentPlanMetadata,
      extensionSystemPrompts,
      undefined, // dreamsContextText — Desktop-only product surface, wired in a later phase
      basicInfo,
      applyPatchPromptSection,
      providerWebSearchPromptSection,
      loopEnabled,
      toolExecutor.mcpToolCatalogSnapshot(),
      attribution,
    );

  const createContinuationState = (messages: LlmMessage[]) =>
    continueLlmToolAgentState(
      messages,
      workspaceRoot,
      enabledRules,
      enabledSkillCatalog,
      transportConfig.model,
      currentPlanMetadata,
      extensionSystemPrompts,
      undefined,
      basicInfo,
      applyPatchPromptSection,
      providerWebSearchPromptSection,
      loopEnabled,
      toolExecutor.mcpToolCatalogSnapshot(),
      attribution,
    );

  const llmTransport = createLlmTransport(transportConfig);

  // 6. Hooks: workspace capability trust routes to clients when available.
  const hookRunner = createHookRunner({
    spiritDataDir,
    workspaceRoot,
    logger: (message) => log(`[hooks] ${message}`),
    requestWorkspaceCapabilityTrust: async (request) => {
      if (options.requestWorkspaceCapabilityTrust) {
        return options.requestWorkspaceCapabilityTrust(request);
      }
      return 'deny';
    },
  });

  const runtime = new AgentRuntime<LlmTransportConfig, LlmToolAgentState, JsonValue, JsonValue>({
    config: transportConfig,
    llmTransport,
    toolExecutor,
    createToolAgentState,
    createContinuationState,
    appendToolResultMessage: appendLlmToolResultMessage,
    assistantToolCallMessageFromState: assistantToolCallMessageFromLlmState,
    finalAssistantHistoryMessageFromState: finalAssistantHistoryMessageFromLlmState,
    appendUserMessage: appendLlmUserMessage,
    appendUserLlmMessage: (state, message) => appendLlmUserLlmMessage(state, message, workspaceRoot),
    extractAssistantText: extractLastLlmAssistantText,
    truncateStateForContextRetry: truncateLlmToolAgentStateForContextRetry,
    truncateHistoryForCompaction: truncateLlmHistoryForCompaction,
    rebuildRetryStateAfterCompaction: (messages, userInput, retryState) =>
      rebuildLlmToolAgentStateAfterCompaction(
        messages,
        userInput,
        retryState,
        workspaceRoot,
        enabledRules,
        enabledSkillCatalog,
        transportConfig.model,
        currentPlanMetadata,
        extensionSystemPrompts,
        undefined,
        basicInfo,
        applyPatchPromptSection,
        providerWebSearchPromptSection,
        loopEnabled,
        toolExecutor.mcpToolCatalogSnapshot(),
        attribution,
      ),
    generateImage: (request) =>
      llmTransport.generateImage(transportConfig, request, async (saveRequest: GeneratedImageSaveRequest) => {
        const saveGeneratedImage = service.saveGeneratedImage;
        if (!saveGeneratedImage) {
          throw new Error('server host: image generation not supported');
        }
        return saveGeneratedImage.call(service, saveRequest);
      }),
    generateVideo: (request) =>
      llmTransport.generateVideo(transportConfig, request, async (saveRequest) => {
        const saveGeneratedVideo = service.saveGeneratedVideo;
        if (!saveGeneratedVideo) {
          throw new Error('server host: video generation not supported');
        }
        return saveGeneratedVideo.call(service, saveRequest);
      }),
    resolveWorkspaceFilesFromInput: (text) => pendingWorkspaceFilesFromInput(workspaceRoot, text),
    hookRunner,
    hookSessionContext: {
      sessionId: sessionKey,
      conversationPath: null,
      workspaceRoot,
      model: transportConfig.model,
    },
    syncSessionTranscript: async ({ transcript, sessionKey: key }) =>
      persistSessionTranscript(spiritDataDir, transcript, {
        sessionKey: key ?? sessionKey,
      }),
    syncSubagentTranscript: async ({ transcript, sessionKey: key, subagentSessionId }) => {
      await persistSubagentTranscript(spiritDataDir, transcript, {
        subagentSessionId,
        sessionKey: key ?? sessionKey,
      });
    },
    resolveSubagentTranscriptPath: ({ sessionKey: key, subagentSessionId }) =>
      resolveSubagentTranscriptFilePath(spiritDataDir, key ?? sessionKey, subagentSessionId),
    persistToolOutputArchive: async (input) => persistToolOutputArchive(spiritDataDir, input),
    getApprovalLevel: () => currentApprovalLevel,
    reviewToolApproval: createCliAutoApprovalReviewer(transportConfig),
    onEvent,
  });

  const setAgentMode = async (mode: SpiritAgentMode): Promise<void> => {
    toolExecutor.setAgentModeToolExposure(mode);
    const refreshed = await loadHostInstructionMetadata(
      { workspaceRoot, spiritDataDir },
      { planMode: mode === 'plan', agentMode: mode },
    );
    currentPlanMetadata = refreshed.planMetadata;
  };

  const setApprovalLevel = (level: ApprovalLevel): void => {
    currentApprovalLevel = level;
    toolExecutor.setApprovalLevel(level);
  };

  return {
    runtime,
    toolExecutor,
    mcpService,
    transportConfig,
    enabledRules,
    enabledSkillCatalog,
    activeSkills,
    setAgentMode,
    setApprovalLevel,
  };
}

import { release as osRelease } from "node:os";

import {
  AgentRuntime,
  McpService,
  buildAgentModeSystemMessage,
  buildApplyPatchFileToolsPromptSection,
  buildBasicInfoSystemMessage,
  buildContributedHostToolDefinitions,
  buildDreamCollectorSystemMessage,
  buildDreamHostToolDefinitions,
  buildExtensionsSystemMessage,
  buildLoopModeSystemMessage,
  buildMcpCatalogSystemMessage,
  buildProviderWebSearchPromptSection,
  buildRulesSystemMessage,
  buildSkillsCatalogSystemMessage,
  buildTodoHostToolDefinitions,
  buildToolAgentHostPrompt,
  createLlmTransport,
  pendingWorkspaceFilesFromInput,
  runSessionEndHook,
  runSessionStartHookAndApply,
  type ContributedHostToolDefinition,
  type GeneratedImageSaveRequest,
  type JsonValue,
  type LlmMessage,
  type LlmTransportConfig,
  type RuntimeEvent,
  type SpiritAgentMode,
} from "@spiritagent/agent-core";
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
} from "@spiritagent/agent-core";
import {
  HostToolExecutorProxy,
  createCliAutoApprovalReviewer,
  type LocalHostToolService,
  type LspHostBindings,
} from "@spiritagent/agent-core/host-bridge";
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
  type HostDreamScope,
  type HostDreamSourceSessionRef,
  type ModelRef,
} from "@spiritagent/host-internal";

import { createNoopPeer } from "./noop-peer.js";

export type ServerHostRuntime = AgentRuntime<
  LlmTransportConfig,
  LlmToolAgentState,
  JsonValue,
  JsonValue
>;

export type ServerClientKind = "cli" | "desktop" | "web";

export type ServerSessionKind = "default" | "dream-collector";

export interface ServerRuntimeOptions {
  workspaceRoot: string;
  spiritDataDir: string;
  /** Transcript + todo scope key; defaults to the session id. */
  sessionKey: string;
  modelRef?: ModelRef;
  /** Todo store scope override (CLI keys todos by its own chat session id). */
  todoSessionKey?: string;
  /** Shared per-workspace MCP service (daemon registry); defaults to a fresh one. */
  mcpService?: McpService;
  /** Extensions/todo surfaces differ per host; a session inherits its creator's kind. */
  hostKind: "cli" | "desktop";
  approvalLevel: ApprovalLevel;
  sessionKind?: ServerSessionKind;
  dreamScope?: HostDreamScope;
  dreamSourceSession?: HostDreamSourceSessionRef;
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
  }) => Promise<"allowOnce" | "deny" | "alwaysTrust">;
  /** Tool-written file changes — broadcast to clients for rewind bookkeeping. */
  onFileChange?: (change: unknown) => void;
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
  approvalLevelSnapshot: () => ApprovalLevel;
  setLoopEnabled: (enabled: boolean) => void;
  /** Re-read installed extensions and refresh tool defs + system prompts. */
  refreshExtensions: () => Promise<void>;
  /** sessionStart hook (startup/resume/open), applying context messages. */
  runSessionStart: (source: "startup" | "resume" | "open") => Promise<void>;
  /** sessionEnd hook (switch/close). */
  runSessionEnd: (reason: "abort" | "switch" | "close") => Promise<void>;
  /** Re-run rules/skills/plan discovery (mode switch or file changes). */
  reloadHostMetadata: (mode: SpiritAgentMode) => Promise<void>;
  /** Export api messages + request trace + assembled system prompts. */
  exportState: () => Promise<unknown>;
  /** Attribution toggles captured by state factory closures. */
  setAttribution: (
    attribution: { commitEnabled?: boolean; prEnabled?: boolean } | undefined,
  ) => void;
  /** Re-scope the todo store (CLI keys todos by its own chat session id). */
  setTodoSessionKey: (sessionKey: string) => void;
  /** Abort a running shell process owned by this session. */
  abortShell: (toolCallId: string) => boolean;
}

/**
 * Assembles a fully-wired AgentRuntime inside the daemon. Supersedes legacy
 * in-host assembly (Desktop in-process runtime, CLI host-bridge sidecar,
 * acp-server local factory). First-party clients attach via WebSocket instead
 * of spawning a sidecar. Tools run in-process via NodeHostToolService, with a
 * real per-session McpService, LSP bindings, extensions, todos, hooks, and
 * transcript persistence.
 */
export async function createServerRuntime(
  options: ServerRuntimeOptions,
): Promise<ServerRuntimeResult> {
  const { workspaceRoot, spiritDataDir, sessionKey, hostKind, onEvent } = options;
  const log = options.log ?? (() => {});
  const approvalLevel = options.approvalLevel;
  const isDreamCollector = options.sessionKind === "dream-collector";
  if (isDreamCollector && !options.dreamScope) {
    throw new Error("dream-collector session requires dreamScope");
  }

  const transportConfig = resolveTransportConfig({
    workspaceRoot,
    spiritDataDir,
    ...(options.modelRef ? { modelRef: options.modelRef } : {}),
  });
  await ensureTranscriptSessionDir(spiritDataDir, sessionKey);

  // 1. Tool executor: noop peer (no stdio peer in the daemon) + per-session MCP.
  const mcpService = isDreamCollector
    ? new McpService(workspaceRoot, true)
    : (options.mcpService ?? new McpService(workspaceRoot, true));
  const toolExecutor = new HostToolExecutorProxy(createNoopPeer(), mcpService);
  if (!isDreamCollector) {
    mcpService.startBackgroundRefreshInBackground(false);
  }

  // 2. Local tool service: real shell/file/web execution, noop management MCP
  //    adapter (MCP tool execution lives on the executor's McpService, same
  //    split as Desktop), extensions, todos, approval level.
  let extensionManager: ReturnType<typeof createHostExtensionManager> | undefined;
  const extensionSystemPrompts: LlmExtensionSystemPrompt[] = [];
  if (!isDreamCollector) {
    await ensureBuiltinAuthoringSkills(spiritDataDir);
    extensionManager = createHostExtensionManager({ spiritDataDir, hostKind });
  }
  let currentApprovalLevel = approvalLevel;
  const service = new NodeHostToolService(
    { workspaceRoot, spiritDataDir },
    {
      mcp: createNoopMcpAdapter(),
      ...(isDreamCollector
        ? {
            dreamScope: options.dreamScope!,
            ...(options.dreamSourceSession
              ? { dreamSourceSession: options.dreamSourceSession }
              : {}),
          }
        : {
            extensions: {
              manager: extensionManager!,
              getHost: () => ({}),
              logger: console,
            },
            fileChangeObserver: {
              async recordFileChange(change: unknown): Promise<void> {
                await toolExecutor.lspServiceSnapshot()?.syncFromRecordedChange(change);
                options.onFileChange?.(change);
              },
            },
            todoScope: { sessionKey: options.todoSessionKey?.trim() || sessionKey },
          }),
      getApprovalLevel: () => currentApprovalLevel,
    },
  );
  toolExecutor.setLocalHostService(service as unknown as LocalHostToolService);
  toolExecutor.setTransportConfigForToolDefinitions(transportConfig);
  toolExecutor.setApprovalLevel(currentApprovalLevel);
  if (isDreamCollector) {
    toolExecutor.setDreamToolDefinitions(buildDreamHostToolDefinitions());
    toolExecutor.setDreamOnlyToolSurface(true);
    toolExecutor.setExtensionToolDefinitions([]);
    toolExecutor.setTodoToolDefinitions([]);
  } else {
    toolExecutor.setTodoToolDefinitions(buildTodoHostToolDefinitions());
    // The bridge passes these via a loosely-typed dynamic import; with static
    // imports the nominal types diverge slightly (structurally compatible).
    toolExecutor.setLspHostBindings({
      LspService,
      appendLspDiagnosticsAfterWriteIfNeeded,
    } as unknown as LspHostBindings);
    await toolExecutor.setLspWorkspaceRoot(workspaceRoot);

    // Extension-contributed tools + system prompts (host-scoped).
    const installedExtensions = await extensionManager!.list();
    toolExecutor.setExtensionToolDefinitions(
      buildContributedHostToolDefinitions(
        collectHostExtensionContributedTools(
          installedExtensions,
        ) as unknown as ContributedHostToolDefinition[],
      ),
    );
    extensionSystemPrompts.push(
      ...(
        await extensionManager!.collectSystemPromptContributions({ host: {}, logger: console })
      ).map((entry) => ({
        extensionId: entry.extensionId,
        extensionName: entry.extensionName,
        content: entry.content,
      })),
    );
  }

  if (isDreamCollector) {
    extensionSystemPrompts.push({
      extensionId: "dream-collector",
      extensionName: "Dream Collector",
      content: buildDreamCollectorSystemMessage(),
    });
  }

  await toolExecutor.refreshCaches();

  // 3. Rules / skills / plan metadata.
  const enabledRules: LlmEnabledRule[] = [];
  const enabledSkillCatalog: LlmEnabledSkillCatalogEntry[] = [];
  let currentPlanMetadata: LlmPlanMetadata | undefined;
  if (isDreamCollector) {
    currentPlanMetadata = {
      path: "",
      exists: false,
      agentMode: "agent",
      planMode: false,
    };
    toolExecutor.setAgentModeToolExposure("agent");
  } else {
    const metadata = await loadHostInstructionMetadata(
      { workspaceRoot, spiritDataDir },
      { planMode: false, agentMode: "agent" },
    );
    enabledRules.push(...metadata.rules.enabledRules);
    enabledSkillCatalog.push(...metadata.skills.enabledSkillCatalog);
    currentPlanMetadata = metadata.planMetadata;
    toolExecutor.setAgentModeToolExposure("agent");
  }

  // 4. Basic info block.
  const shell = service.toolDefinitionEnvironment();
  const basicInfo: LlmToolAgentBasicInfo = {
    workspaceRoot,
    ...(shell?.shellDisplayName ? { terminal: shell.shellDisplayName } : {}),
    gitBranch:
      isDreamCollector && options.dreamScope
        ? options.dreamScope.gitBranch
        : await readGitBranchLabelForBasicInfo(workspaceRoot),
    sessionTranscript: resolveTranscriptSessionDir(spiritDataDir, sessionKey),
    system: service.operatingSystemInfo?.() ?? {
      name:
        process.platform === "win32"
          ? "Windows"
          : process.platform === "darwin"
            ? "macOS"
            : process.platform === "linux"
              ? "Linux"
              : process.platform,
      version: osRelease(),
    },
  };

  // 5. Prompt sections.
  const applyPatchPromptSection =
    transportConfig.transportKind === "open-responses"
      ? buildApplyPatchFileToolsPromptSection()
      : undefined;
  const providerWebSearchPromptSection = buildProviderWebSearchPromptSection(transportConfig);

  const activeSkills: LlmActiveSkill[] = [];
  // Mutable: state factory closures capture the binding; setLoopEnabled updates it.
  let loopEnabled = false;
  let attribution: { commitEnabled?: boolean; prEnabled?: boolean } | undefined;

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
      return "deny";
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
    appendUserLlmMessage: (state, message) =>
      appendLlmUserLlmMessage(state, message, workspaceRoot),
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
      llmTransport.generateImage(
        transportConfig,
        request,
        async (saveRequest: GeneratedImageSaveRequest) => {
          const saveGeneratedImage = service.saveGeneratedImage;
          if (!saveGeneratedImage) {
            throw new Error("server host: image generation not supported");
          }
          return saveGeneratedImage.call(service, saveRequest);
        },
      ),
    generateVideo: (request) =>
      llmTransport.generateVideo(transportConfig, request, async (saveRequest) => {
        const saveGeneratedVideo = service.saveGeneratedVideo;
        if (!saveGeneratedVideo) {
          throw new Error("server host: video generation not supported");
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
    if (isDreamCollector) {
      return;
    }
    toolExecutor.setAgentModeToolExposure(mode);
    const refreshed = await loadHostInstructionMetadata(
      { workspaceRoot, spiritDataDir },
      { planMode: mode === "plan", agentMode: mode },
    );
    currentPlanMetadata = refreshed.planMetadata;
  };

  const setApprovalLevel = (level: ApprovalLevel): void => {
    currentApprovalLevel = level;
    toolExecutor.setApprovalLevel(level);
  };

  const setLoopEnabled = (enabled: boolean): void => {
    loopEnabled = enabled;
    runtime.setLoopEnabled(enabled);
    toolExecutor.setLoopToolExposure(enabled);
  };

  const refreshExtensions = async (): Promise<void> => {
    if (isDreamCollector || !extensionManager) {
      return;
    }
    const installed = await extensionManager.list();
    toolExecutor.setExtensionToolDefinitions(
      buildContributedHostToolDefinitions(
        collectHostExtensionContributedTools(
          installed,
        ) as unknown as ContributedHostToolDefinition[],
      ),
    );
    const collected = await extensionManager.collectSystemPromptContributions({
      host: {},
      logger: console,
    });
    extensionSystemPrompts.length = 0;
    extensionSystemPrompts.push(
      ...collected.map((entry) => ({
        extensionId: entry.extensionId,
        extensionName: entry.extensionName,
        content: entry.content,
      })),
    );
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
    approvalLevelSnapshot: () => currentApprovalLevel,
    setLoopEnabled,
    refreshExtensions,
    runSessionStart: async (source) => {
      await runSessionStartHookAndApply(
        hookRunner,
        (role, content) => runtime.recordContextMessage(role, content),
        {
          sessionId: sessionKey,
          conversationPath: null,
          workspaceRoot,
          model: transportConfig.model,
        },
        source,
      );
    },
    runSessionEnd: async (reason) => {
      await runSessionEndHook(
        hookRunner,
        {
          sessionId: sessionKey,
          conversationPath: null,
          workspaceRoot,
          model: transportConfig.model,
        },
        reason,
      );
    },
    reloadHostMetadata: async (mode) => {
      if (isDreamCollector) {
        return;
      }
      const refreshed = await loadHostInstructionMetadata(
        { workspaceRoot, spiritDataDir },
        { planMode: mode === "plan", agentMode: mode },
      );
      enabledRules.length = 0;
      enabledRules.push(...refreshed.rules.enabledRules);
      enabledSkillCatalog.length = 0;
      enabledSkillCatalog.push(...refreshed.skills.enabledSkillCatalog);
      currentPlanMetadata = refreshed.planMetadata;
    },
    exportState: async () => {
      const exportTransport = createLlmTransport(transportConfig);
      const baseSystemPrompts = exportTransport.llmSystemPromptsForExport() as Record<
        string,
        JsonValue
      >;
      const rulesSystemPrompt = buildRulesSystemMessage(enabledRules);
      const skillsCatalogSystemPrompt = buildSkillsCatalogSystemMessage(enabledSkillCatalog);
      const mcpCatalogSystemPrompt = buildMcpCatalogSystemMessage(
        toolExecutor.mcpToolCatalogSnapshot(),
      );
      const agentModeSystemPrompt = buildAgentModeSystemMessage(currentPlanMetadata);
      const loopModeSystemPrompt = buildLoopModeSystemMessage(runtime.loopEnabled());
      const extensionsSystemPrompt = buildExtensionsSystemMessage(extensionSystemPrompts);
      const basicInfoSystemPrompt = buildBasicInfoSystemMessage(basicInfo);
      return {
        apiMessages: exportTransport.llmHistoryAsApiMessages([...runtime.history()]),
        requestTrace: [...runtime.requestTrace()],
        systemPrompts: {
          ...baseSystemPrompts,
          tool_agent: buildToolAgentHostPrompt(transportConfig.model),
          ...(rulesSystemPrompt === undefined ? {} : { rules: rulesSystemPrompt }),
          ...(skillsCatalogSystemPrompt === undefined
            ? {}
            : { skillsCatalog: skillsCatalogSystemPrompt }),
          ...(mcpCatalogSystemPrompt === undefined ? {} : { mcpCatalog: mcpCatalogSystemPrompt }),
          agentMode: agentModeSystemPrompt,
          ...(loopModeSystemPrompt === undefined ? {} : { loopMode: loopModeSystemPrompt }),
          ...(extensionsSystemPrompt === undefined ? {} : { extensions: extensionsSystemPrompt }),
          ...(basicInfoSystemPrompt === undefined ? {} : { basicInfo: basicInfoSystemPrompt }),
        },
      };
    },
    setAttribution: (next) => {
      attribution = next;
    },
    setTodoSessionKey: (key) => {
      service.setTodoScope?.({ sessionKey: key });
    },
    abortShell: (toolCallId) => service.abortShell(toolCallId),
  };
}

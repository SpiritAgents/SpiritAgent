import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";

import { modelReasoningEffortLabel } from "@spirit-agent/core/reasoning-effort";
import {
  charCountToCodeUnitIndex,
  codeUnitIndexToCharCount,
  currentWorkspaceFileReferenceQuery,
} from "@spirit-agent/host-internal/workspace-file-reference-query";

import {
  SessionSidebarChromeProvider,
  type SessionSidebarChromeApi,
  useSessionSidebarChrome,
} from "@/contexts/session-sidebar-chrome-context";
import { cycleAgentMode, type DesktopAgentMode } from "@/lib/agent-mode";
import {
  resolveComposerDirectMediaTool,
  type DirectMediaTool,
} from "@/lib/composer-direct-media";
import {
  pickEmptySessionGreetingVariant,
  resolveEmptySessionGreeting,
  type EmptySessionGreetingVariantId,
} from "@/lib/empty-session-greeting";
import {
  resolveWorkspaceDisplayLabel,
  resolveWorkspaceSelectorLabel,
  sameWorkspacePath,
} from "@/lib/workspace-display-label";

import {
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  Download,
  FolderPlus,
  LoaderCircle,
  Maximize2,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  ShieldCheck,
  Square,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AnimatedCollapse,
  AnimatedCollapseContent,
  AnimatedCollapseTrigger,
} from "@/components/ui/animated-collapse";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HoverDetailTooltip,
  useHoverDetailTooltipContext,
} from "@/components/ui/hover-detail-tooltip";
import { ModelPickerMenu } from "@/components/model-picker-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AgentMarkdownMessage } from "@/components/agent-markdown-message";
import { AutomationsView } from "@/components/automations-view";
import { AutomationDetailView } from "@/components/automation-detail-view";
import { CreateAutomationDialog } from "@/components/create-automation-dialog";
import { MarketplaceView } from "@/components/marketplace-view";
import {
  ComposerLocalFileStrip,
  type ComposerLocalFileAttachmentView,
} from "@/components/composer-local-file-strip";
import {
  ComposerRichInput,
  segmentsToMessageText,
  type ComposerRichInputHandle,
  type RichSegment,
} from "@/components/composer-rich-input";
import type { BrowserElementAttachment } from "@/lib/browser-element-attachment";
import {
  messageContentToRichSegments,
  segmentsToAttachments,
  segmentsToPlainText,
} from "@/lib/composer-segment-model";
import { ComposerInsertMenu } from "@/components/composer-insert-menu";
import { ApprovalLevelMenu } from "@/components/approval-level-menu";
import { ComposerContextUsageRing } from "@/components/composer-context-usage-ring";
import { BranchSelectMenu } from "@/components/branch-select-menu";
import { WorkLocationMenu } from "@/components/work-location-menu";
import { SkillSlashMenu } from "@/components/skill-slash-menu";
import { SettingsView } from "@/components/settings-view";
import { ComposerTodoCard } from "@/components/composer-todo-card";
import { MinimalToolCallCard } from "@/components/minimal-tool-call-card";
import { PendingApprovalCard } from "@/components/pending-approval-card";
import { PendingQuestionsCard } from "@/components/pending-questions-card";
import { ProcessCardCollapsible } from "@/components/process-card-collapsible";
import { SessionChromeBreadcrumb } from "@/components/session-chrome-breadcrumb";
import { ToolCallDiffHostProvider } from "@/components/tool-call-diff-host-context";
import { isMinimalToolCallMessage, toolHasExpandableContent } from "@/lib/tool-call-display";
import {
  isGenericPendingThinkingStatusText,
  isSubagentStatusSurfaceMessage,
} from "@/lib/subagent-display";
import {
  assistantCompactionLive,
  shouldShowAssistantCompactionCollapsible,
} from "@/lib/conversation-compaction-ui";
import { resolveTurnContinuePresentation } from "@/lib/conversation-continue-ui";
import {
  buildConversationRenderItems,
  isMessageHiddenByProcessGroup,
} from "@/lib/conversation-process-groups";
import {
  hasAssistantBodyTextLaterInTurn,
  isAssistantReasoningLive,
  shouldCollapseThinkingDuringToolPreview,
  shouldShowAssistantThinkingCollapsible,
} from "@/lib/conversation-thinking-ui";
import { isGenericPendingCompactionStatusText } from "@/lib/subagent-display";
import {
  isGrayMetaLeadingMessage,
  isGrayMetaTrailingMessage,
  isStandaloneAssistantAuxMessage,
  shouldCompactAfterPreviousRenderItem,
  shouldTightenAfterPreviousRenderItem,
} from "@/lib/message-card-spacing";
import { WorkspaceFileReferenceMenu } from "@/components/workspace-file-reference-menu";
import { ActionPickerDialog } from "@/components/action-picker-dialog";
import { WorkspaceFilePickerDialog } from "@/components/workspace-file-picker-dialog";
import { QueuedUserMessageHoverActions } from "@/components/queued-user-message-hover-actions";
import { UserMessageBubble } from "@/components/user-message-bubble";
import { useProcessSealAnimationGate } from "@/lib/process-seal-animation";
import { useCompactionUiDemo } from "@/hooks/useCompactionUiDemo";
import { useElementBoxHeight } from "@/hooks/use-element-box-height";
import { useSubagentViewer } from "@/hooks/useSubagentViewer";
import { isRunSubagentToolCallPending } from "@/lib/subagent-viewer-pending";
import { useDesktopRuntime } from "@/hooks/useDesktopRuntime";
import { useWorkspaceFileIndex } from "@/hooks/use-workspace-file-index";
import { useLocalFileAttachmentPreviews } from "@/hooks/useLocalFileAttachmentPreviews";
import { useClickablePointerCursor } from "@/hooks/useClickablePointerCursor";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { isManagedGeneratedVideoRef } from "@/lib/managed-generated-asset";
import {
  appendComposerLocalFileAttachment,
  composerAttachmentViewFromPath,
  isPreviewableImagePath,
  isPreviewableVideoPath,
  normalizeSlashPath as normalizeAttachmentPath,
  removeComposerLocalFileAttachment,
  snapshotsToComposerAttachmentViews,
} from "@/lib/local-file-attachments";
import {
  FilteredOverlayMenu,
  FilteredOverlayMenuTrigger,
} from "@/components/ui/filtered-overlay-menu";
import {
  DESKTOP_CHROME_TOGGLE_ICON_BTN,
  DESKTOP_SHELL_LAYOUT_TRANSITION,
  DESKTOP_OVERLAY_LIST_ACTION_ITEM,
  DESKTOP_OVERLAY_LIST_GROUP_LABEL,
  DESKTOP_OVERLAY_LIST_ITEM,
  DESKTOP_OVERLAY_LIST_ITEM_PRIMARY,
  DESKTOP_OVERLAY_LIST_ITEM_SECONDARY,
  DESKTOP_OVERLAY_LIST_SUB_TRIGGER,
  instantHoverMotionClass,
} from "@/lib/desktop-chrome";
import { readWorkspaceToolsWidthPx } from "@/lib/layout-prefs";
import { resolveModelPickerToOpen } from "@/lib/model-picker-shortcut-bridge";
import {
  isNewSessionAction,
  type ActionPaletteItem,
} from "@/lib/action-palette";
import {
  buildSkillSlashSuggestions,
  currentSkillSlashQueryAtCursor,
  skillSlashAlias,
  skillSlashQueryKey,
  type SkillSlashSuggestion,
} from "@/lib/skill-slash";
import {
  desktopNativeThemeForPreference,
  resolveDark,
  syncDesktopWindowFrame,
  type ThemePreference,
} from "@/lib/theme";
import {
  resolveEffectiveEmptySession,
  shouldClearConversationSnapshotStale,
  shouldHideStaleConversationMessages,
  shouldMarkConversationSnapshotStale,
  shouldSuppressStaleConversation,
} from "@/lib/conversation-surface-stale";
import { cn } from "@/lib/utils";
import { DesktopTitleBar } from "@/components/desktop-title-bar";
import { desktopMicaTintClass, desktopMicaTintInnerClass } from "@/lib/desktop-mica-surface";
import {
  desktopShellPlatform,
  isElectronChrome,
  isMacDesktopPlatform,
  isNativeBackdropBlurSupported,
  ctrlLetterShortcutKbdKeys,
  isModAltShortcutPressed,
  isModShortcutPressed,
  modAltLetterShortcutKbdKeys,
  modLetterShortcutKbdKeys,
  resolveUseMicaBackdrop,
  isWin32ElectronShell,
  isDarwinElectronShell,
} from "@/lib/desktop-shell";
import { LaunchSplash } from "@/components/launch-splash";
import { SessionSidebar, type SettingsSidebarTab } from "@/components/session-sidebar";
import { SessionSidebarShell } from "@/components/session-sidebar-shell";
import { WorkspaceToolsDock } from "@/components/workspace-tools-panel";
import {
  addWorkspaceBrowserTabWithUrl,
  addWorkspaceToolTab,
  createInitialWorkspaceToolsState,
  normalizeWorkspaceToolTabsForHost,
  findWorkspaceToolTab,
  focusFirstTabOfKind,
} from "@/lib/workspace-tool-tabs";
import { normalizeBrowserUrl } from "@/lib/browser-url";
import {
  buildOpenEditorFileNavigation,
  type EditorFileTarget,
  type WorkspaceEditorViewMode,
} from "@/lib/workspace-editor-navigation";
import { isMarkdownPath } from "@/lib/file-picker-path";
import type {
  DesktopModelReasoningEffort,
  ConversationMessageSnapshot,
  DesktopSnapshot,
  MessageRewindDraftState,
  PendingAssistantAux,
  ToolBlockSnapshot,
  WorkspaceFileReferenceSuggestionsResponse,
} from "@/types";

import {
  conversationMessageStableId,
  resolveConversationListScopeKey,
} from "@/lib/conversation-list-scope";

/** 主会话列最大宽度（居中） */

import {
  CONVERSATION_COMPOSER_SCROLL_BED_FALLBACK_PX,
  CONVERSATION_GUTTER_NEG_X,
  CONVERSATION_GUTTER_X,
  CONVERSATION_MAX_W,
  CONVERSATION_SCROLL_BED_EXTRA_PX,
} from "@/lib/conversation-layout-constants";
import { ComposerSurface } from "@/components/composer/composer-surface";
import { MessageCard } from "@/components/conversation/message-card";
import { ToolCallCollapsible } from "@/components/tool-call/tool-call-collapsible";
import { EmptyStateWorkspaceSelector } from "@/components/empty-state-workspace-selector";
import { WebHostPairingGate } from "@/components/web-host-pairing-gate";
import { DesktopLayoutChromeBar } from "@/components/layout/desktop-layout-chrome-bar";

export default function App() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { font, setFont } = useFont();
  const { clickablePointerCursor, setClickablePointerCursor } = useClickablePointerCursor();
  const runtime = useDesktopRuntime();
  const snapshot = runtime.snapshot;
  /** 与 Host API 的 `kind` 解耦：壳可能是 Electron，但仍通过 Vite 代理走 Web Host（侧栏会显示 Localhost Web Host）。Mica 与 `spirit-desktop-native` 仍应对 Electron 窗口生效。 */
  const isElectronShell = isElectronChrome();
  const winElectronChrome = isWin32ElectronShell();
  const darwinElectronChrome = isDarwinElectronShell();
  const desktopTitleBarChrome = winElectronChrome || darwinElectronChrome;
  const useMicaBackdrop = resolveUseMicaBackdrop(snapshot?.config.windowsMica);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    if (isElectronShell) {
      document.documentElement.classList.add("spirit-desktop-native");
    } else {
      document.documentElement.classList.remove("spirit-desktop-native");
    }
  }, [isElectronShell]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    if (darwinElectronChrome) {
      document.documentElement.classList.add("spirit-desktop-darwin");
    } else {
      document.documentElement.classList.remove("spirit-desktop-darwin");
      document.documentElement.classList.remove("spirit-desktop-darwin-fullscreen");
    }
  }, [darwinElectronChrome]);

  useEffect(() => {
    if (!darwinElectronChrome || typeof document === "undefined") {
      return;
    }
    const bridge = window.spiritDesktop;
    if (!bridge?.getWindowFullScreen || !bridge.subscribeWindowFullScreen) {
      return;
    }
    const applyFullscreenChrome = (fullScreen: boolean) => {
      document.documentElement.classList.toggle("spirit-desktop-darwin-fullscreen", fullScreen);
    };
    void bridge.getWindowFullScreen().then(applyFullscreenChrome);
    return bridge.subscribeWindowFullScreen(applyFullscreenChrome);
  }, [darwinElectronChrome]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    if (useMicaBackdrop) {
      document.documentElement.classList.add("spirit-desktop-mica");
    } else {
      document.documentElement.classList.remove("spirit-desktop-mica");
    }
  }, [useMicaBackdrop]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const styleNodes = Array.from(
      document.head.querySelectorAll<HTMLStyleElement>('style[data-spirit-extension-css="true"]'),
    );
    for (const node of styleNodes) {
      node.remove();
    }

    const layers = snapshot?.extensionCss ?? [];
    for (const layer of layers) {
      const style = document.createElement("style");
      style.dataset.spiritExtensionCss = "true";
      style.dataset.extensionId = layer.extensionId;
      style.dataset.sourcePath = layer.sourcePath;
      if (layer.media) {
        style.media = layer.media;
      }
      style.textContent = layer.cssText;
      document.head.append(style);
    }

    return () => {
      for (const node of document.head.querySelectorAll<HTMLStyleElement>('style[data-spirit-extension-css="true"]')) {
        node.remove();
      }
    };
  }, [snapshot?.extensionCss]);

  // 与 `config.windows_mica` 持久化对齐（保存模糊开关后桌面宿主会先按系统主题同步一帧，此处用 `html.dark` 再拉齐）
  useEffect(() => {
    if (!isElectronShell) {
      return;
    }
    syncDesktopWindowFrame(resolveDark(theme), desktopNativeThemeForPreference(theme));
    // 主题变更由 `applyThemeToDocument` 同步边框；此处仅随模糊效果配置变更
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅 windowsMica / 原生模糊宿主
  }, [isElectronShell, snapshot?.config.windowsMica]);

  const compactionDemo = useCompactionUiDemo();
  const subagentViewer = useSubagentViewer(runtime.setSubagentViewerTarget);
  const subagentViewActive = subagentViewer.active && Boolean(snapshot?.subagentViewer);
  const handleOpenSubagentViewer = useCallback(
    (toolCallId: string) => {
      compactionDemo.stop();
      void subagentViewer.open(toolCallId);
    },
    [compactionDemo, subagentViewer],
  );
  const models = snapshot?.config.models ?? [];
  const composerSessionKey = snapshot?.composerSessionKey ?? "";
  const emptySessionGreetingCacheRef = useRef(new Map<string, EmptySessionGreetingVariantId>());
  const workspaceDisplayLabel = useMemo(
    () =>
      resolveWorkspaceDisplayLabel(
        snapshot?.workspaceRoot ?? "",
        snapshot?.workspaceBinding ?? "project",
        snapshot?.availableWorkspaces ?? [],
      ),
    [
      snapshot?.availableWorkspaces,
      snapshot?.workspaceBinding,
      snapshot?.workspaceRoot,
      i18n.language,
    ],
  );
  const includeWorkspaceGreetingVariants = workspaceDisplayLabel !== null;
  const emptySessionGreeting = useMemo(() => {
    const sessionKey = composerSessionKey.trim() || "__no-session__";
    let variantId = emptySessionGreetingCacheRef.current.get(sessionKey);
    if (!variantId) {
      variantId = pickEmptySessionGreetingVariant({
        includeWorkspaceVariants: includeWorkspaceGreetingVariants,
      });
      emptySessionGreetingCacheRef.current.set(sessionKey, variantId);
    }
    return resolveEmptySessionGreeting(t, variantId, workspaceDisplayLabel);
  }, [
    composerSessionKey,
    includeWorkspaceGreetingVariants,
    workspaceDisplayLabel,
    t,
    i18n.language,
  ]);
  const sessionMessages = snapshot?.conversation.messages ?? [];
  const sessionNavigationBusy = runtime.busyAction === "session";
  const newSessionBusy = runtime.busyAction === "reset";
  const messages = subagentViewActive
    ? (snapshot?.subagentViewer?.messages ?? [])
    : compactionDemo.active
      ? compactionDemo.messages
      : sessionMessages;
  const conversationListScopeKey = resolveConversationListScopeKey({
    subagentViewActive,
    subagentToolCallId: subagentViewer.toolCallId,
    compactionDemoActive: compactionDemo.active,
  });
  const conversationRenderItems = useMemo(
    () => buildConversationRenderItems(messages, conversationListScopeKey),
    [conversationListScopeKey, messages],
  );
  const conversationViewKey = `${composerSessionKey.trim() || "__no-session__"}:${conversationListScopeKey}`;
  const processGroupManualOpenKey = (groupId: string) => `${conversationViewKey}:${groupId}`;
  const conversationPendingAuxState = subagentViewActive
    ? snapshot?.subagentViewer?.pendingAuxState
    : compactionDemo.active
      ? compactionDemo.pendingAuxState
      : snapshot?.conversation.pendingAuxState;
  const [conversationListRemountEpoch, setConversationListRemountEpoch] = useState(0);
  const prevSessionMessageCountRef = useRef(sessionMessages.length);

  useEffect(() => {
    const count = sessionMessages.length;
    if (count < prevSessionMessageCountRef.current) {
      setConversationListRemountEpoch((epoch) => epoch + 1);
    }
    prevSessionMessageCountRef.current = count;
  }, [sessionMessages.length]);

  const shouldPlayProcessSealAnimation = useProcessSealAnimationGate({
    conversationViewKey,
    renderItems: conversationRenderItems,
    subagentViewActive,
    compactionDemoActive: compactionDemo.active,
    isBusy: snapshot?.conversation.isBusy,
    busyAction: runtime.busyAction,
    pendingAuxState: conversationPendingAuxState,
    sessionMessages,
    planResetKey: conversationListRemountEpoch,
  });
  const [processGroupManualOpen, setProcessGroupManualOpen] = useState<Record<string, boolean>>({});
  const turnContinue = useMemo(
    () => (compactionDemo.active || subagentViewActive ? undefined : resolveTurnContinuePresentation(messages)),
    [compactionDemo.active, messages, subagentViewActive],
  );

  const rewindWarnings = snapshot?.conversation.rewindWarnings ?? [];
  const pendingApproval = snapshot?.conversation.pendingToolApproval;
  const showPendingApprovalInComposer = Boolean(
    pendingApproval
    && (
      !subagentViewActive
      || pendingApproval.subagentSessionId === snapshot?.subagentViewer?.sessionId
    ),
  );
  const { ref: composerDockRef, heightPx: composerDockHeightPx } = useElementBoxHeight<HTMLDivElement>();
  const conversationScrollBedPaddingPx =
    composerDockHeightPx > 0
      ? Math.max(
          CONVERSATION_COMPOSER_SCROLL_BED_FALLBACK_PX,
          composerDockHeightPx + CONVERSATION_SCROLL_BED_EXTRA_PX,
        )
      : CONVERSATION_COMPOSER_SCROLL_BED_FALLBACK_PX;
  const pendingQuestions = runtime.pendingQuestions;
  const showPendingQuestionsInComposer = Boolean(pendingQuestions);
  useLocalFileAttachmentPreviews(
    runtime.composerLocalFileAttachments,
    runtime.setComposerLocalFileAttachments,
    runtime.readLocalImagePreviewDataUrl,
  );

  const [composerBrowserElementAttachments, setComposerBrowserElementAttachments] = useState<BrowserElementAttachment[]>([]);

  const activeSessionReadOnly = snapshot?.activeSession?.readOnly === true;
  const composerDirectMediaMode = useMemo(() => {
    if (!snapshot?.config) {
      return null;
    }
    return resolveComposerDirectMediaTool(snapshot.config.activeModel, snapshot.config);
  }, [snapshot?.config]);
  const composerPlaceholder = activeSessionReadOnly
    ? t("app.readOnlySession")
    : composerDirectMediaMode === "generate_image"
      ? t("composer.placeholderGenerateImage")
      : composerDirectMediaMode === "generate_video"
        ? t("composer.placeholderGenerateVideo")
        : t("app.typeMessage");
  const conversationInterruptible = runtime.summary.canInterrupt && !runtime.busyAction;
  const messageRewindComposerEnabled =
    !compactionDemo.active &&
    !subagentViewActive &&
    !activeSessionReadOnly &&
    !pendingApproval &&
    !pendingQuestions &&
    runtime.busyAction !== "rewind" &&
    runtime.busyAction !== "session";
  const continueBusy = Boolean(runtime.busyAction) || snapshot?.conversation.isBusy === true;
  const composerHasPayload =
    Boolean(runtime.composer.trim()) || runtime.composerLocalFileAttachments.length > 0;
  const conversationAbortShortcutEligible =
    conversationInterruptible && !activeSessionReadOnly;
  const conversationAbortShortcutEligibleRef = useRef(false);
  conversationAbortShortcutEligibleRef.current = conversationAbortShortcutEligible;
  const composerCanSend =
    !compactionDemo.active &&
    !subagentViewActive &&
    composerHasPayload &&
    !activeSessionReadOnly &&
    runtime.busyAction !== "session" &&
    !pendingApproval &&
    !pendingQuestions &&
    (runtime.summary.canSend || conversationInterruptible) &&
    !(runtime.busyAction === "send" && !conversationInterruptible);
  const startImplementingDisabled =
    !snapshot?.runtimeReady ||
    activeSessionReadOnly ||
    runtime.busyAction === "session" ||
    Boolean(pendingApproval) ||
    Boolean(pendingQuestions) ||
    (runtime.busyAction === "send" && !conversationInterruptible);
  const [rewindDraft, setRewindDraft] = useState<MessageRewindDraftState | null>(null);
  const previousComposerSessionKeyRef = useRef(composerSessionKey);

  useEffect(() => {
    if (previousComposerSessionKeyRef.current !== composerSessionKey) {
      previousComposerSessionKeyRef.current = composerSessionKey;
      if (subagentViewer.active) {
        void subagentViewer.close();
      }
    }
  }, [composerSessionKey, subagentViewer]);

  useEffect(() => {
    if (subagentViewer.active && !snapshot?.subagentViewer) {
      const toolCallId = subagentViewer.toolCallId;
      const stillStarting = toolCallId
        ? isRunSubagentToolCallPending(snapshot?.conversation.messages ?? [], toolCallId)
        : false;
      if (stillStarting) {
        return;
      }
      void subagentViewer.close();
    }
  }, [snapshot?.conversation.messages, snapshot?.subagentViewer, subagentViewer]);

  useEffect(() => {
    if (rewindDraft && subagentViewer.active) {
      void subagentViewer.close();
    }
  }, [rewindDraft, subagentViewer]);
  useLocalFileAttachmentPreviews(
    rewindDraft?.localFileAttachments ?? [],
    (update) => {
      setRewindDraft((current) => {
        if (!current) {
          return current;
        }
        const localFileAttachments =
          typeof update === "function" ? update(current.localFileAttachments) : update;
        return { ...current, localFileAttachments };
      });
    },
    runtime.readLocalImagePreviewDataUrl,
  );

  const [activeSurface, setActiveSurface] = useState<
    "conversation" | "settings" | "marketplace" | "automations" | "automation-detail"
  >("conversation");
  const activeSurfaceRef = useRef(activeSurface);
  activeSurfaceRef.current = activeSurface;
  const [conversationSnapshotStale, setConversationSnapshotStale] = useState(false);
  const [lastNonSettingsSurface, setLastNonSettingsSurface] = useState<
    "conversation" | "marketplace" | "automations"
  >("conversation");
  const [selectedAutomationId, setSelectedAutomationId] = useState<string | null>(null);
  const [createAutomationDialogOpen, setCreateAutomationDialogOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsSidebarTab>("models");
  const [extensionSettingsId, setExtensionSettingsId] = useState<string | null>(null);
  const sessionSidebarChromeApiRef = useRef<SessionSidebarChromeApi | null>(null);

  useEffect(() => {
    if (shouldMarkConversationSnapshotStale(activeSurface)) {
      setConversationSnapshotStale(true);
    }
  }, [activeSurface]);

  useEffect(() => {
    if (
      shouldClearConversationSnapshotStale({
        activeSurface,
        sessionNavigationBusy,
        newSessionBusy,
      })
    ) {
      setConversationSnapshotStale(false);
    }
  }, [activeSurface, newSessionBusy, sessionNavigationBusy]);

  const [workspaceToolsOpen, setWorkspaceToolsOpen] = useState(false);
  const initialWorkspaceToolsRef = useRef<ReturnType<
    typeof createInitialWorkspaceToolsState
  > | null>(null);
  if (initialWorkspaceToolsRef.current === null) {
    initialWorkspaceToolsRef.current = createInitialWorkspaceToolsState(false);
  }
  const initialWorkspaceTools = initialWorkspaceToolsRef.current;
  const [workspaceToolTabs, setWorkspaceToolTabs] = useState(() => initialWorkspaceTools.tabs);
  const [activeWorkspaceToolTabId, setActiveWorkspaceToolTabId] = useState(
    () => initialWorkspaceTools.activeTabId,
  );
  const activeWorkspaceToolTabIdRef = useRef(activeWorkspaceToolTabId);
  activeWorkspaceToolTabIdRef.current = activeWorkspaceToolTabId;
  const workspaceToolTabsRef = useRef(workspaceToolTabs);
  workspaceToolTabsRef.current = workspaceToolTabs;
  const workspaceToolsHostSyncedRef = useRef<typeof runtime.hostKind | null>(null);
  const browserTabEnabled = runtime.hostKind === "electron";
  const [workspaceFilesPlanRevealNonce, setWorkspaceFilesPlanRevealNonce] = useState(0);
  const [workspaceFilesPlanRevealTargetId, setWorkspaceFilesPlanRevealTargetId] = useState<
    string | null
  >(null);
  const [workspaceFileRevealNonce, setWorkspaceFileRevealNonce] = useState(0);
  const [workspaceFileRevealTargetId, setWorkspaceFileRevealTargetId] = useState<string | null>(
    null,
  );
  const [workspaceFileRevealPath, setWorkspaceFileRevealPath] = useState("");
  const [workspaceFileRevealAbsolutePath, setWorkspaceFileRevealAbsolutePath] = useState("");
  const [workspaceFileRevealScope, setWorkspaceFileRevealScope] = useState<
    EditorFileTarget["scope"]
  >("workspace");
  const [workspaceFileRevealViewMode, setWorkspaceFileRevealViewMode] =
    useState<WorkspaceEditorViewMode>("edit");
  const [workspaceToolsWidthPx, setWorkspaceToolsWidthPx] = useState(readWorkspaceToolsWidthPx);

  const openBrowserUrlInNewTab = useCallback((rawUrl: string) => {
    if (runtime.hostKind !== "electron") {
      return;
    }
    const url = normalizeBrowserUrl(rawUrl);
    if (!url) {
      return;
    }
    setWorkspaceToolsOpen(true);
    let nextActiveId = "";
    setWorkspaceToolTabs((prev) => {
      const next = addWorkspaceBrowserTabWithUrl(prev, url);
      nextActiveId = next.activeId;
      return next.tabs;
    });
    if (nextActiveId) {
      setActiveWorkspaceToolTabId(nextActiveId);
    }
  }, [runtime.hostKind]);

  const openEditorFile = useCallback((target: EditorFileTarget) => {
    const navigation = buildOpenEditorFileNavigation({
      tabs: workspaceToolTabsRef.current,
      activeTabId: activeWorkspaceToolTabIdRef.current,
      target,
    });
    setWorkspaceToolsOpen(true);
    setWorkspaceToolTabs(navigation.tabs);
    setActiveWorkspaceToolTabId(navigation.activeTabId);
    setWorkspaceFileRevealTargetId(navigation.filesTabId);
    setWorkspaceFileRevealScope(target.scope);
    setWorkspaceFileRevealViewMode(target.viewMode);
    if (target.scope === "workspace") {
      setWorkspaceFileRevealPath(target.relativePath);
      setWorkspaceFileRevealAbsolutePath("");
    } else {
      setWorkspaceFileRevealPath("");
      setWorkspaceFileRevealAbsolutePath(target.absolutePath);
    }
    setWorkspaceFileRevealNonce((value) => value + 1);
  }, []);

  const openWorkspaceFile = useCallback(
    (relativePath: string, options?: { viewMode?: WorkspaceEditorViewMode }) => {
      openEditorFile({
        scope: "workspace",
        relativePath,
        viewMode: options?.viewMode ?? "edit",
      });
    },
    [openEditorFile],
  );

  useEffect(() => {
    if (!runtime.apiReady || runtime.hostKind == null) {
      return;
    }
    if (workspaceToolsHostSyncedRef.current === runtime.hostKind) {
      return;
    }
    workspaceToolsHostSyncedRef.current = runtime.hostKind;
    const includeBrowser = runtime.hostKind === "electron";
    setWorkspaceToolTabs((prev) => {
      const normalized = normalizeWorkspaceToolTabsForHost(
        prev,
        activeWorkspaceToolTabIdRef.current,
        includeBrowser,
      );
      if (normalized.activeId !== activeWorkspaceToolTabIdRef.current) {
        setActiveWorkspaceToolTabId(normalized.activeId);
      }
      return normalized.tabs;
    });
  }, [runtime.apiReady, runtime.hostKind]);

  useEffect(() => {
    const bridge = window.spiritDesktop;
    if (!bridge?.subscribeBrowserOpenUrl) {
      return;
    }
    return bridge.subscribeBrowserOpenUrl(openBrowserUrlInNewTab);
  }, [openBrowserUrlInNewTab]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (!isModShortcutPressed(event) || event.key.toLowerCase() !== 'p') {
        return;
      }
      event.preventDefault();
      if (event.shiftKey) {
        setActionPickerOpen(true);
        return;
      }
      setFilePickerOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (!isModShortcutPressed(event) || event.key !== "/") {
        return;
      }
      const picker = resolveModelPickerToOpen();
      if (!picker) {
        return;
      }
      event.preventDefault();
      picker.open();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (event.altKey) {
        return;
      }
      if (!isModShortcutPressed(event) || event.key.toLowerCase() !== "b") {
        return;
      }
      event.preventDefault();
      sessionSidebarChromeApiRef.current?.toggle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (!isModAltShortcutPressed(event)) {
        return;
      }
      if (event.code !== "KeyB") {
        return;
      }
      if (activeSurfaceRef.current !== "conversation") {
        return;
      }
      event.preventDefault();
      setWorkspaceToolsOpen((current) => !current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Physical Ctrl+C — abort the in-flight turn; composer may still have draft text.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (!event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
        return;
      }
      if (event.code !== "KeyC") {
        return;
      }
      if (activeSurfaceRef.current !== "conversation") {
        return;
      }
      if (!conversationAbortShortcutEligibleRef.current) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest(".workspace-shell-xterm, .xterm, .monaco-editor")) {
        return;
      }
      if (
        target &&
        (target.tagName === "TEXTAREA" ||
          target.tagName === "INPUT" ||
          target.tagName === "SELECT" ||
          (target.isContentEditable &&
            !target.closest("[data-spirit-surface='composer-surface']")))
      ) {
        return;
      }
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        return;
      }
      event.preventDefault();
      void runtime.abortConversation();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runtime.abortConversation]);

  const [composerCursorCodeUnits, setComposerCursorCodeUnits] = useState(0);
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(-1);
  const [fileReferenceSuggestions, setFileReferenceSuggestions] =
    useState<WorkspaceFileReferenceSuggestionsResponse>(null);
  const [fileReferenceSelectedIndex, setFileReferenceSelectedIndex] = useState(-1);
  const [dismissedFileReferenceKey, setDismissedFileReferenceKey] = useState<string | null>(null);
  const [dismissedSlashQueryKey, setDismissedSlashQueryKey] = useState<string | null>(null);
  const [filePickerOpen, setFilePickerOpen] = useState(false);
  const [actionPickerOpen, setActionPickerOpen] = useState(false);
  const [branchCheckoutDialogOpen, setBranchCheckoutDialogOpen] = useState(false);
  const [branchCheckoutBlockedByChanges, setBranchCheckoutBlockedByChanges] = useState(false);
  const pendingComposerSendRef = useRef<{
    text: string;
    localFilePaths?: string[];
  } | null>(null);
  const activeFilePath = snapshot?.activeSession?.filePath ?? null;
  const commitBusy = runtime.busyAction === "git";
  const gitChipBusy =
    runtime.busyAction === "send" || snapshot?.conversation.isBusy === true;
  const composerRichInputRef = useRef<ComposerRichInputHandle | null>(null);
  const rewindRichInputRef = useRef<ComposerRichInputHandle | null>(null);

  const handleComposerAgentModeChange = useCallback(
    (agentMode: DesktopAgentMode) => {
      void runtime.saveSettingsPatch({ agentMode });
      if (agentMode === "plan" || agentMode === "ask" || agentMode === "debug") {
        runtime.setAgentModeChipDismissed(false);
      }
      if (agentMode === "plan") {
        composerRichInputRef.current?.insertPlanChip({ clearText: false });
      } else if (agentMode === "ask") {
        composerRichInputRef.current?.insertAskChip({ clearText: false });
      } else if (agentMode === "debug") {
        composerRichInputRef.current?.insertDebugChip({ clearText: false });
      } else {
        composerRichInputRef.current?.removeAgentModeChip();
      }
    },
    [runtime],
  );
  const handleNewSession = useCallback(() => {
    setLastNonSettingsSurface("conversation");
    setActiveSurface("conversation");
    void runtime.resetSession();
  }, [runtime]);

  // Cmd/Ctrl+N — 全局快捷键触发新会话（macOS 由系统菜单 accelerator 处理，此处跳过）
  useEffect(() => {
    if (desktopShellPlatform() === 'darwin') {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (!isModShortcutPressed(event) || event.key.toLowerCase() !== 'n') {
        return;
      }
      // 用户在 composer / 富文本编辑区内按键时不触发
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
      }
      event.preventDefault();
      handleNewSession();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleNewSession]);

  // Electron File 菜单 → “新会话” IPC 订阅
  useEffect(() => {
    const bridge = window.spiritDesktop;
    if (!bridge?.subscribeNewSession) {
      return;
    }
    return bridge.subscribeNewSession(handleNewSession);
  }, [handleNewSession]);

  const handleGenerateAutomation = useCallback(async () => {
    setLastNonSettingsSurface("conversation");
    setActiveSurface("conversation");
    const seed = t("automations.generateComposerSeed");
    const resetOk = await runtime.resetSession();
    if (!resetOk) {
      return;
    }
    runtime.setComposer(seed);
    setSlashSelectedIndex(-1);
    queueMicrotask(() => {
      composerRichInputRef.current?.focus();
    });
  }, [runtime, t]);
  const previousPlanModifiedAtRef = useRef<number | undefined>(undefined);
  const previousPlanExistsRef = useRef<boolean | undefined>(undefined);
  const previousActiveSessionPathRef = useRef<string | null>(null);
  const settingsMode = activeSurface === "settings";
  const marketplaceMode = activeSurface === "marketplace";
  const automationsMode = activeSurface === "automations" || activeSurface === "automation-detail";
  const automationDetailMode = activeSurface === "automation-detail";
  const suppressStaleConversation = shouldSuppressStaleConversation({
    conversationSnapshotStale,
    activeSurface,
    sessionNavigationBusy,
    newSessionBusy,
  });
  const hideStaleConversationMessages = shouldHideStaleConversationMessages({
    suppressStaleConversation,
    sessionNavigationBusy,
  });
  const isEmptySession = resolveEffectiveEmptySession({
    sessionMessageCount: sessionMessages.length,
    subagentViewActive,
    compactionDemoActive: compactionDemo.active,
    newSessionBusy,
  });
  /** 仅空会话展示工作区/分支等待选控件；有消息后隐藏（含无工作区绑定会话）。 */
  const showWorkspaceBindingControls = isEmptySession;
  useEffect(() => {
    const plan = snapshot?.plan;
    const sessionPath = snapshot?.activeSession?.filePath ?? null;
    if (!plan) {
      return;
    }

    const sessionChanged =
      previousActiveSessionPathRef.current !== null &&
      previousActiveSessionPathRef.current !== sessionPath;

    const previousExists = previousPlanExistsRef.current;
    const previousModifiedAt = previousPlanModifiedAtRef.current;

    previousActiveSessionPathRef.current = sessionPath;
    previousPlanExistsRef.current = plan.exists;
    previousPlanModifiedAtRef.current = plan.modifiedAtUnixMs;

    if (sessionChanged) {
      return;
    }

    const created = previousExists === false && plan.exists;
    const modified =
      plan.exists &&
      plan.modifiedAtUnixMs !== undefined &&
      previousModifiedAt !== undefined &&
      plan.modifiedAtUnixMs !== previousModifiedAt;

    if (!created && !modified) {
      return;
    }

    setWorkspaceToolsOpen(true);

    const activeTab = findWorkspaceToolTab(workspaceToolTabs, activeWorkspaceToolTabId);
    let targetFilesTabId: string;
    if (activeTab?.kind === "files") {
      targetFilesTabId = activeWorkspaceToolTabId;
    } else {
      const firstFilesId = focusFirstTabOfKind(workspaceToolTabs, "files");
      if (firstFilesId) {
        targetFilesTabId = firstFilesId;
        setActiveWorkspaceToolTabId(firstFilesId);
      } else {
        const added = addWorkspaceToolTab(workspaceToolTabs, "files");
        setWorkspaceToolTabs(added.tabs);
        setActiveWorkspaceToolTabId(added.activeId);
        targetFilesTabId = added.activeId;
      }
    }

    setWorkspaceFilesPlanRevealTargetId(targetFilesTabId);
    setWorkspaceFilesPlanRevealNonce((value) => value + 1);
  }, [
    activeFilePath,
    activeWorkspaceToolTabId,
    snapshot?.plan.exists,
    snapshot?.plan.modifiedAtUnixMs,
    snapshot?.plan,
    workspaceToolTabs,
  ]);
  const composerCursorChars = useMemo(
    () => codeUnitIndexToCharCount(runtime.composer, composerCursorCodeUnits),
    [composerCursorCodeUnits, runtime.composer],
  );
  const slashQuery = useMemo(() => {
    const query = currentSkillSlashQueryAtCursor(runtime.composer, composerCursorChars);
    if (!query) {
      return undefined;
    }
    if (dismissedSlashQueryKey === skillSlashQueryKey(query)) {
      return undefined;
    }
    return query;
  }, [composerCursorChars, dismissedSlashQueryKey, runtime.composer]);
  const slashSuggestions = useMemo(
    () => buildSkillSlashSuggestions(slashQuery?.raw, snapshot?.skillsList ?? []),
    [slashQuery, snapshot?.skillsList],
  );
  const fileReferenceQuery = useMemo(
    () => currentWorkspaceFileReferenceQuery(runtime.composer, composerCursorChars),
    [composerCursorChars, runtime.composer],
  );
  const fileReferenceQueryKey = useMemo(
    () =>
      fileReferenceQuery
        ? `${fileReferenceQuery.start}\u0000${fileReferenceQuery.end}\u0000${fileReferenceQuery.raw}`
        : "",
    [fileReferenceQuery],
  );
  const workspaceFileIndex = useWorkspaceFileIndex({
    workspaceRoot: snapshot?.workspaceRoot ?? "",
    workspaceBinding: snapshot?.workspaceBinding ?? "project",
    primeWorkspaceFileReferenceIndex: runtime.primeWorkspaceFileReferenceIndex,
    getWorkspaceFileReferenceIndex: runtime.getWorkspaceFileReferenceIndex,
  });
  const extensionSettingsItems = useMemo(
    () =>
      (snapshot?.extensionsList ?? [])
        .filter((item) => item.desktopSettingsPage)
        .map((item) => ({
          id: item.id,
          label: item.desktopSettingsPage?.title ?? item.displayName,
        })),
    [snapshot?.extensionsList],
  );

  useEffect(() => {
    setSlashSelectedIndex(-1);
  }, [slashQuery?.raw, slashQuery?.start, slashQuery?.end]);

  useEffect(() => {
    if (!fileReferenceQuery || dismissedFileReferenceKey === fileReferenceQueryKey) {
      setFileReferenceSuggestions(null);
      setFileReferenceSelectedIndex(-1);
      return;
    }

    if (!workspaceFileIndex.ready) {
      setFileReferenceSuggestions({
        query: fileReferenceQuery,
        suggestions: [],
      });
      return;
    }

    setFileReferenceSuggestions({
      query: fileReferenceQuery,
      suggestions: workspaceFileIndex.search(fileReferenceQuery.raw),
    });
  }, [
    dismissedFileReferenceKey,
    fileReferenceQuery,
    fileReferenceQueryKey,
    workspaceFileIndex.ready,
    workspaceFileIndex.fileCount,
    workspaceFileIndex.search,
  ]);

  useEffect(() => {
    if (slashSuggestions.length === 0) {
      if (slashSelectedIndex !== -1) {
        setSlashSelectedIndex(-1);
      }
      return;
    }
    if (slashSelectedIndex >= slashSuggestions.length) {
      setSlashSelectedIndex(-1);
    }
  }, [slashSelectedIndex, slashSuggestions.length]);

  useEffect(() => {
    const suggestionCount = fileReferenceSuggestions?.suggestions.length ?? 0;
    if (suggestionCount === 0) {
      if (fileReferenceSelectedIndex !== -1) {
        setFileReferenceSelectedIndex(-1);
      }
      return;
    }

    if (fileReferenceSelectedIndex >= suggestionCount) {
      setFileReferenceSelectedIndex(-1);
    }
  }, [fileReferenceSelectedIndex, fileReferenceSuggestions?.suggestions.length]);

  useEffect(() => {
    if (!rewindDraft) {
      return;
    }
    const anchor = messages[rewindDraft.listIndex];
    const stillAvailable =
      anchor?.id === rewindDraft.messageId && anchor.canRewind === true;
    if (!stillAvailable) {
      setRewindDraft(null);
    }
  }, [messages, rewindDraft]);

  const startMessageRewind = (message: ConversationMessageSnapshot, listIndex: number) => {
    if (!messageRewindComposerEnabled || message.canRewind !== true) {
      return;
    }
    const segments = messageContentToRichSegments(message.content, String(message.id));
    setRewindDraft({
      messageId: message.id,
      listIndex,
      text: segmentsToPlainText(segments),
      browserElementAttachments: segmentsToAttachments(segments),
      localFileAttachments: snapshotsToComposerAttachmentViews(message.localFileAttachments),
    });
  };

  const submitMessageRewind = () => {
    if (!rewindDraft) {
      return;
    }
    const segs = rewindRichInputRef.current?.getSegments() ?? [];
    const wireText = segmentsToMessageText(segs) || rewindDraft.text;
    void runtime
      .rewindAndSubmitMessage({
        messageId: rewindDraft.messageId,
        text: wireText,
        ...(rewindDraft.localFileAttachments.length > 0
          ? { localFilePaths: rewindDraft.localFileAttachments.map((item) => item.path) }
          : {}),
      })
      .then((ok) => {
        if (ok) {
          setRewindDraft(null);
        }
      });
  };

  const applySlashSuggestion = (replacement: string) => {
    if (slashQuery) {
      composerRichInputRef.current?.replaceSkillSlashQuery(slashQuery, replacement, true);
    } else {
      runtime.setComposer(replacement);
    }
    setSlashSelectedIndex(-1);
    setDismissedSlashQueryKey(null);
    queueMicrotask(() => {
      composerRichInputRef.current?.focus();
    });
  };

  const applyLoopSlash = useCallback(() => {
    setSlashSelectedIndex(-1);
    setDismissedSlashQueryKey(null);
    void runtime.setLoopEnabled(true);
    composerRichInputRef.current?.insertLoopChip({ clearText: false });
    if (slashQuery) {
      composerRichInputRef.current?.removeSkillSlashQuery(slashQuery);
    }
  }, [runtime, slashQuery]);

  const applyPlanSlash = useCallback(() => {
    setSlashSelectedIndex(-1);
    setDismissedSlashQueryKey(null);
    void runtime.saveSettingsPatch({ agentMode: "plan" });
    runtime.setAgentModeChipDismissed(false);
    composerRichInputRef.current?.insertPlanChip({ clearText: false });
    if (slashQuery) {
      composerRichInputRef.current?.removeSkillSlashQuery(slashQuery);
    }
  }, [runtime, slashQuery]);

  const applyAskSlash = useCallback(() => {
    setSlashSelectedIndex(-1);
    setDismissedSlashQueryKey(null);
    void runtime.saveSettingsPatch({ agentMode: "ask" });
    runtime.setAgentModeChipDismissed(false);
    composerRichInputRef.current?.insertAskChip({ clearText: false });
    if (slashQuery) {
      composerRichInputRef.current?.removeSkillSlashQuery(slashQuery);
    }
  }, [runtime, slashQuery]);

  const applyDebugSlash = useCallback(() => {
    setSlashSelectedIndex(-1);
    setDismissedSlashQueryKey(null);
    void runtime.saveSettingsPatch({ agentMode: "debug" });
    runtime.setAgentModeChipDismissed(false);
    composerRichInputRef.current?.insertDebugChip({ clearText: false });
    if (slashQuery) {
      composerRichInputRef.current?.removeSkillSlashQuery(slashQuery);
    }
  }, [runtime, slashQuery]);

  const applySlashSuggestionItem = useCallback(
    (suggestion: SkillSlashSuggestion) => {
      if (suggestion.kind === "loop") {
        applyLoopSlash();
        return;
      }
      if (suggestion.kind === "plan") {
        applyPlanSlash();
        return;
      }
      if (suggestion.kind === "ask") {
        applyAskSlash();
        return;
      }
      if (suggestion.kind === "debug") {
        applyDebugSlash();
        return;
      }
      if (suggestion.kind === "skill") {
        setSlashSelectedIndex(-1);
        setDismissedSlashQueryKey(null);
        if (slashQuery) {
          composerRichInputRef.current?.removeSkillSlashQuery(slashQuery);
        }
        queueMicrotask(() => {
          composerRichInputRef.current?.insertSkillChip(suggestion.alias);
        });
        return;
      }
      applySlashSuggestion(`${suggestion.alias} `);
    },
    [applyAskSlash, applyDebugSlash, applyLoopSlash, applyPlanSlash, slashQuery],
  );

  const ensureConversationSurface = useCallback(() => {
    setLastNonSettingsSurface("conversation");
    setActiveSurface("conversation");
  }, []);

  const prefillComposerSkillChip = useCallback(
    (skillName: string) => {
      const alias = skillSlashAlias(skillName);
      setLastNonSettingsSurface("conversation");
      setActiveSurface("conversation");
      runtime.setComposer("");
      setSlashSelectedIndex(-1);
      setDismissedSlashQueryKey(null);
      queueMicrotask(() => {
        composerRichInputRef.current?.insertSkillChip(alias, {
          clearText: true,
          appendTrailingSpace: true,
        });
        composerRichInputRef.current?.focus();
      });
    },
    [runtime],
  );

  const isActionPaletteItemDisabled = useCallback(
    (item: ActionPaletteItem) => {
      if (!runtime.busyAction) {
        return false;
      }
      if (isNewSessionAction(item)) {
        return true;
      }
      return item.kind === "log-session" || item.kind === "compact";
    },
    [runtime.busyAction],
  );

  const runActionPaletteItem = useCallback(
    (item: ActionPaletteItem) => {
      ensureConversationSurface();
      if (isNewSessionAction(item)) {
        handleNewSession();
        return;
      }
      if (item.kind === "loop") {
        applyLoopSlash();
        return;
      }
      if (item.kind === "plan") {
        applyPlanSlash();
        return;
      }
      if (item.kind === "ask") {
        applyAskSlash();
        return;
      }
      if (item.kind === "debug") {
        applyDebugSlash();
        return;
      }
      if (item.kind === "log-session" || item.kind === "compact") {
        void runtime.sendMessage({ text: item.alias });
        return;
      }
      applySlashSuggestion(`${item.alias} `);
    },
    [
      applyAskSlash,
      applyDebugSlash,
      applyLoopSlash,
      applyPlanSlash,
      ensureConversationSurface,
      handleNewSession,
      runtime,
    ],
  );

  const applyFileReferenceSuggestion = (path: string) => {
    const query = fileReferenceSuggestions?.query;
    if (!query) {
      return;
    }

    composerRichInputRef.current?.insertWorkspaceFileReference(path, query, true);
    setFileReferenceSelectedIndex(-1);
    setDismissedFileReferenceKey(null);
  };

  const insertComposerText = (text: string) => {
    const segments = composerRichInputRef.current?.getSegments() ?? [];
    const hasRichChips = segments.some((segment) => segment.kind !== "text");
    if (hasRichChips) {
      composerRichInputRef.current?.insertPlainTextAtCaret(text);
    } else {
      const selectionStart = composerCursorCodeUnits;
      const selectionEnd = selectionStart;
      const nextValue = `${runtime.composer.slice(0, selectionStart)}${text}${runtime.composer.slice(selectionEnd)}`;
      const nextCursorCodeUnits = selectionStart + text.length;
      runtime.setComposer(nextValue);
      setComposerCursorCodeUnits(nextCursorCodeUnits);
    }
    setSlashSelectedIndex(-1);
    setFileReferenceSelectedIndex(-1);
    setFileReferenceSuggestions(null);
    setDismissedFileReferenceKey(null);
    setDismissedSlashQueryKey(null);
    queueMicrotask(() => {
      composerRichInputRef.current?.focus();
    });
  };

  const insertFileReferenceTrigger = () => {
    insertComposerText("@");
  };

  const insertSkillTriggerFromPalette = () => {
    insertComposerText("/");
  };

  const removeLocalFileAttachment = (path: string) => {
    removeComposerLocalFileAttachment(runtime.setComposerLocalFileAttachments, path);
  };

  const removeRewindLocalFileAttachment = (path: string) => {
    setRewindDraft((current) => {
      if (!current) {
        return current;
      }
      const localFileAttachments = current.localFileAttachments.filter(
        (item) => normalizeAttachmentPath(item.path) !== normalizeAttachmentPath(path),
      );
      return { ...current, localFileAttachments };
    });
  };

  const attachLocalFilePath = useCallback(
    (filePath: string) => {
      appendComposerLocalFileAttachment(runtime.setComposerLocalFileAttachments, filePath, {
        onAfterAttach: () => {
          queueMicrotask(() => {
            composerRichInputRef.current?.focus();
          });
        },
      });
    },
    [runtime.setComposerLocalFileAttachments],
  );

  const handleBrowserElementPicked = useCallback(
    async (attachment: BrowserElementAttachment) => {
      composerRichInputRef.current?.insertAttachment(attachment);
      const base64 = attachment.screenshotDataUrl.replace(/^data:image\/png;base64,/, '');
      const bridge = window.spiritDesktop;
      if (bridge?.ingestBrowserElementScreenshot) {
        const filePath = await bridge.ingestBrowserElementScreenshot(base64);
        if (filePath) {
          attachLocalFilePath(filePath);
        }
      }
    },
    [attachLocalFilePath],
  );

  const attachRewindLocalFilePath = useCallback((filePath: string) => {
    setRewindDraft((current) => {
      if (!current) {
        return current;
      }
      const normalizedPath = normalizeAttachmentPath(filePath);
      if (
        current.localFileAttachments.some(
          (item) => normalizeAttachmentPath(item.path) === normalizedPath,
        )
      ) {
        return current;
      }
      return {
        ...current,
        localFileAttachments: [
          ...current.localFileAttachments,
          composerAttachmentViewFromPath(normalizedPath),
        ],
      };
    });
  }, []);

  const pickLocalFileFromPalette = () => {
    void runtime.pickLocalFile().then((filePath) => {
      if (!filePath) {
        return;
      }
      attachLocalFilePath(filePath);
    });
  };

  const handleComposerPaste = useCallback(
    (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
      if (activeSessionReadOnly || runtime.hostKind !== "electron") {
        return;
      }

      const hasClipboardImage = Array.from(event.clipboardData?.items ?? []).some(
        (item) => item.kind === "file" && item.type.startsWith("image/"),
      );
      if (!hasClipboardImage) {
        return;
      }

      event.preventDefault();
      void runtime.ingestClipboardImage().then((filePath) => {
        if (filePath) {
          attachLocalFilePath(filePath);
        }
      });
    },
    [activeSessionReadOnly, attachLocalFilePath, runtime],
  );

  const handleRewindComposerPaste = useCallback(
    (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
      if (activeSessionReadOnly || runtime.hostKind !== "electron" || !rewindDraft) {
        return;
      }

      const hasClipboardImage = Array.from(event.clipboardData?.items ?? []).some(
        (item) => item.kind === "file" && item.type.startsWith("image/"),
      );
      if (!hasClipboardImage) {
        return;
      }

      event.preventDefault();
      void runtime.ingestClipboardImage().then((filePath) => {
        if (filePath) {
          attachRewindLocalFilePath(filePath);
        }
      });
    },
    [activeSessionReadOnly, attachRewindLocalFilePath, rewindDraft, runtime],
  );

  const pickRewindLocalFileFromPalette = () => {
    void runtime.pickLocalFile().then((filePath) => {
      if (!filePath) {
        return;
      }
      attachRewindLocalFilePath(filePath);
    });
  };

  const submitComposerMessage = () => {
    const segs = composerRichInputRef.current?.getSegments() ?? [];
    const fullText = segmentsToMessageText(segs) || runtime.composer;
    const payload = {
      text: fullText,
      ...(runtime.composerLocalFileAttachments.length > 0
        ? {
            localFilePaths: runtime.composerLocalFileAttachments.map((item) => item.path),
          }
        : {}),
    };

    if (
      isEmptySession &&
      snapshot?.git.isRepository &&
      snapshot.git.workLocation === "local"
    ) {
      const selectedBranch = snapshot.git.selectedBranch ?? snapshot.git.branch;
      if (selectedBranch && snapshot.git.branch && selectedBranch !== snapshot.git.branch) {
        pendingComposerSendRef.current = payload;
        setBranchCheckoutDialogOpen(true);
        return;
      }
    }

    void runtime.sendMessage(payload).then((ok) => {
      if (ok) {
        setComposerBrowserElementAttachments([]);
        composerRichInputRef.current?.resetAfterSend(runtime.settings.agentMode);
      }
    });
  };

  const confirmBranchCheckoutAndSend = () => {
    void (async () => {
      const pending = pendingComposerSendRef.current;
      const selectedBranch = snapshot?.git.selectedBranch ?? snapshot?.git.branch;
      if (!pending || !selectedBranch) {
        setBranchCheckoutDialogOpen(false);
        return;
      }

      const result = await runtime.checkoutGitBranch(selectedBranch);
      if (result.ok) {
        pendingComposerSendRef.current = null;
        setBranchCheckoutBlockedByChanges(false);
        setBranchCheckoutDialogOpen(false);
        void runtime.sendMessage(pending).then((ok) => {
          if (ok) {
            composerRichInputRef.current?.resetAfterSend(runtime.settings.agentMode);
          }
        });
        return;
      }

      if (result.reason === "local-changes") {
        setBranchCheckoutBlockedByChanges(true);
        return;
      }
    })();
  };

  const discardBranchChangesAndCheckoutSend = () => {
    void (async () => {
      const pending = pendingComposerSendRef.current;
      const selectedBranch = snapshot?.git.selectedBranch ?? snapshot?.git.branch;
      if (!pending || !selectedBranch) {
        setBranchCheckoutDialogOpen(false);
        return;
      }

      const result = await runtime.checkoutGitBranch(selectedBranch, { discardLocalChanges: true });
      if (!result.ok) {
        return;
      }

      pendingComposerSendRef.current = null;
      setBranchCheckoutBlockedByChanges(false);
      setBranchCheckoutDialogOpen(false);
      void runtime.sendMessage(pending).then((ok) => {
        if (ok) {
          composerRichInputRef.current?.resetAfterSend(runtime.settings.agentMode);
        }
      });
    })();
  };

  const handleComposerSuggestionKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    const fileReferenceItems = fileReferenceSuggestions?.suggestions ?? [];

    if (slashQuery) {
      if (event.key === "Escape") {
        event.preventDefault();
        setDismissedSlashQueryKey(skillSlashQueryKey(slashQuery));
        setSlashSelectedIndex(-1);
        return;
      }

      if (slashSuggestions.length > 0) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSlashSelectedIndex((current) => {
            if (current < 0) {
              return 0;
            }
            return (current + 1) % slashSuggestions.length;
          });
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSlashSelectedIndex((current) =>
            current <= 0 ? slashSuggestions.length - 1 : current - 1,
          );
          return;
        }

        if (event.key === "Tab") {
          event.preventDefault();
          const selected = slashSuggestions[slashSelectedIndex] ?? slashSuggestions[0];
          if (selected) {
            applySlashSuggestionItem(selected);
          }
          return;
        }

        if (event.key === "Enter" && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
          event.preventDefault();
          const selected = slashSuggestions[slashSelectedIndex] ?? slashSuggestions[0];
          if (selected) {
            applySlashSuggestionItem(selected);
          }
          return;
        }
      }
    }

    if (fileReferenceItems.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setFileReferenceSelectedIndex((current) => {
          if (current < 0) {
            return 0;
          }
          return (current + 1) % fileReferenceItems.length;
        });
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setFileReferenceSelectedIndex((current) =>
          current <= 0 ? fileReferenceItems.length - 1 : current - 1,
        );
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setDismissedFileReferenceKey(fileReferenceQueryKey);
        setFileReferenceSelectedIndex(-1);
        setFileReferenceSuggestions(null);
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        const selected = fileReferenceItems[fileReferenceSelectedIndex] ?? fileReferenceItems[0];
        if (selected) {
          applyFileReferenceSuggestion(selected);
        }
        return;
      }

      if (event.key === "Enter" && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        event.preventDefault();
        const selected = fileReferenceItems[fileReferenceSelectedIndex] ?? fileReferenceItems[0];
        if (selected) {
          applyFileReferenceSuggestion(selected);
        }
      }
    }
  };

  const handleComposerKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    handleComposerSuggestionKeyDown(event);
    if (event.defaultPrevented) {
      return;
    }
    // Shift+Tab — 循环切换 Agent 模式（Agent → Plan → Ask → Debug → Agent）
    if (
      event.key === 'Tab' &&
      event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      const nextMode = cycleAgentMode(runtime.settings.agentMode);
      handleComposerAgentModeChange(nextMode);
      return;
    }
    if (
      pendingApproval &&
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      // React synthetic event 的 isComposing 不可靠，必须用 nativeEvent 检测 IME 组合态
      !event.nativeEvent.isComposing &&
      runtime.busyAction !== "approve"
    ) {
      event.preventDefault();
      void runtime.submitApproval({ kind: "allow" });
    }
  };

  const launchSplashActive =
    snapshot === null &&
    !runtime.hostConnectionError.trim() &&
    !runtime.runtimeError.trim();

  if (runtime.webHostPairingRequired && runtime.hostKind === "web" && !snapshot) {
    return (
      <WebHostPairingGate
        busy={runtime.busyAction === "bootstrap"}
        error={runtime.runtimeError}
        onPair={runtime.pairWebHost}
      />
    );
  }

  return (
    <SessionSidebarChromeProvider apiRef={sessionSidebarChromeApiRef}>
    <div
      data-spirit-surface="app-shell"
      data-spirit-shell-kind={isElectronShell ? "electron" : "web"}
      data-spirit-theme={resolveDark(theme) ? "dark" : "light"}
      data-spirit-mica={useMicaBackdrop ? "true" : "false"}
      className={cn(
        "flex h-[100dvh] min-h-0 flex-col text-foreground",
        useMicaBackdrop ? "bg-transparent" : "bg-background",
      )}
    >
      <LaunchSplash active={launchSplashActive} useMicaBackdrop={useMicaBackdrop} />
      {winElectronChrome ? (
        <DesktopTitleBar useMicaBackdrop={useMicaBackdrop} />
      ) : null}
      <div data-spirit-surface="app-body" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {!desktopTitleBarChrome ? (
          <div
            className={cn(
              "h-px w-full shrink-0",
              // 非 Electron：壳顶部分隔线
              useMicaBackdrop
                ? "bg-black/5 dark:bg-white/10"
                : "bg-border/30 dark:bg-white/12",
            )}
            role="separator"
            aria-orientation="horizontal"
          />
        ) : null}
        <div data-spirit-surface="main-frame" className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <SessionSidebarShell useMicaBackdrop={useMicaBackdrop}>
          <SessionSidebar
            narrow={false}
            mode={settingsMode ? "settings" : "sessions"}
            userHomeDirectory={snapshot?.userHomeDirectory ?? null}
            sessions={runtime.sessions}
            activeFilePath={activeFilePath}
            onNewSession={handleNewSession}
            onSelectSession={(path) => {
              setLastNonSettingsSurface("conversation");
              setActiveSurface("conversation");
              void runtime.openSession(path);
            }}
            onOpenMarketplace={() => {
              sessionSidebarChromeApiRef.current?.openSidebar();
              setLastNonSettingsSurface("marketplace");
              setActiveSurface("marketplace");
            }}
            onOpenAutomations={() => {
              sessionSidebarChromeApiRef.current?.openSidebar();
              setLastNonSettingsSurface("automations");
              setSelectedAutomationId(null);
              setActiveSurface("automations");
            }}
            onOpenSettings={() => {
              sessionSidebarChromeApiRef.current?.openSidebar();
              if (activeSurface !== "settings") {
                setLastNonSettingsSurface(
                  activeSurface === "marketplace"
                    ? "marketplace"
                    : activeSurface === "automations" || activeSurface === "automation-detail"
                      ? "automations"
                      : "conversation",
                );
              }
              setActiveSurface("settings");
            }}
            onBackToSessions={() => setActiveSurface(lastNonSettingsSurface)}
            marketplaceActive={marketplaceMode}
            automationsActive={automationsMode}
            settingsTab={settingsTab}
            extensionSettingsId={extensionSettingsId}
            extensionSettingsItems={extensionSettingsItems}
            onSettingsTabChange={(tab) => {
              setExtensionSettingsId(null);
              setSettingsTab(tab);
            }}
            onExtensionSettingsChange={(id) => setExtensionSettingsId(id)}
            micaStyle={useMicaBackdrop}
            newSessionBusy={newSessionBusy}
            sessionNavigationBusy={sessionNavigationBusy}
            deleteSessionBusy={sessionNavigationBusy}
            onDeleteSession={(path) => {
              void runtime.deleteSession(path);
            }}
            deleteWorkspaceBusy={sessionNavigationBusy}
            onDeleteWorkspace={(workspacePath) => {
              void runtime.deleteWorkspace(workspacePath);
            }}
            unseenCompletedSessionPaths={runtime.unseenCompletedSessionPaths}
          />
        </SessionSidebarShell>

        {settingsMode ? (
          <div data-spirit-surface="settings-shell" className={cn("flex min-h-0 min-w-0 flex-1 flex-col", desktopMicaTintInnerClass(useMicaBackdrop))}>
            <DesktopLayoutChromeBar
              useMicaBackdrop={useMicaBackdrop}
              showWorkspaceToggle={false}
            />
            <SettingsView
              useMicaBackdrop={useMicaBackdrop}
              tab={settingsTab}
              extensionSettingsId={extensionSettingsId}
              theme={theme}
              onThemeChange={setTheme}
              font={font}
              onFontChange={setFont}
              clickablePointerCursor={clickablePointerCursor}
              onClickablePointerCursorChange={setClickablePointerCursor}
              settings={runtime.settings}
              snapshot={snapshot}
              runtimeError={runtime.runtimeError}
              apiReady={runtime.apiReady}
              busyAction={runtime.busyAction}
              modelsBusy={runtime.busyAction === "models"}
              modelsPreviewBusy={runtime.busyAction === "modelsPreview"}
              mcpsBusy={runtime.busyAction === "mcps"}
              hooksBusy={runtime.busyAction === "hooks"}
              skillsBusy={runtime.busyAction === "skills"}
              rulesBusy={runtime.busyAction === "rules"}
              extensionsBusy={runtime.busyAction === "extensions"}
              lspInstallBusy={runtime.lspInstallBusy}
              isElectronShell={isElectronShell}
              onSavePatch={runtime.saveSettingsPatch}
              onInstallLspProvider={runtime.installLspProvider}
              onResetWebHostPairing={runtime.resetWebHostPairing}
              onAddModel={runtime.addModel}
              onAddProviderModels={runtime.addProviderModels}
              onPreviewModels={runtime.previewModels}
              onRemoveModel={runtime.removeModel}
              onRemoveProviderModels={runtime.removeProviderModels}
              onAddMcpServer={runtime.addMcpServer}
              onImportExtension={runtime.importExtension}
              onDeleteExtension={runtime.deleteExtension}
              onUpdateExtensionSettings={runtime.updateExtensionSettings}
              onUpdateExtensionSecret={runtime.updateExtensionSecret}
              onDeleteMcpServer={runtime.deleteMcpServer}
              onSaveHookEntry={runtime.saveHookEntry}
              onDeleteHookEntry={runtime.deleteHookEntry}
              onInspectMcpServer={runtime.inspectMcpServer}
              onCreateSkill={runtime.createSkill}
              onCreateRule={runtime.createRule}
              onStartCompactionUiDemo={() => {
                setActiveSurface("conversation");
                compactionDemo.start();
              }}
              onDeleteSkill={runtime.deleteSkill}
              onDeleteRule={runtime.deleteRule}
              onListDreamsOverview={runtime.listDreamsOverview}
              onGenerateSkillNavigate={() => {
                prefillComposerSkillChip("create-skill");
              }}
              onGenerateRuleNavigate={() => {
                prefillComposerSkillChip("create-rule");
              }}
            />
          </div>
        ) : automationsMode ? (
          <div data-spirit-surface="automations-layout" className={cn("flex min-h-0 min-w-0 flex-1 flex-col", desktopMicaTintInnerClass(useMicaBackdrop))}>
            <DesktopLayoutChromeBar
              useMicaBackdrop={useMicaBackdrop}
              showWorkspaceToggle={false}
            />
            <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", desktopMicaTintClass(useMicaBackdrop))}>
            {automationDetailMode && selectedAutomationId ? (
              <AutomationDetailView
                automationId={selectedAutomationId}
                snapshot={snapshot}
                sessions={runtime.sessions}
                onBack={() => {
                  setSelectedAutomationId(null);
                  setActiveSurface("automations");
                }}
                onOpenSession={(path) => {
                  setLastNonSettingsSurface("conversation");
                  setActiveSurface("conversation");
                  void runtime.openSession(path);
                }}
                getAutomation={runtime.getAutomation}
                updateAutomation={(id, patch) => void runtime.updateAutomation(id, patch)}
                settingsDisabled={!runtime.apiReady || runtime.busyAction === "automation"}
                onAddWorkspace={() => void runtime.pickWorkspaceDirectory?.().then((path) => {
                  if (path) {
                    void runtime.rememberWorkspaceRoot(path);
                  }
                })}
              />
            ) : (
              <AutomationsView
                snapshot={snapshot}
                apiReady={runtime.apiReady}
                busyAction={runtime.busyAction}
                onGenerateAutomation={() => void handleGenerateAutomation()}
                onCreateAutomation={() => setCreateAutomationDialogOpen(true)}
                onOpenAutomation={(automationId) => {
                  setSelectedAutomationId(automationId);
                  setActiveSurface("automation-detail");
                }}
                onDeleteAutomation={async (automationId) => {
                  await runtime.deleteAutomation(automationId);
                  if (selectedAutomationId === automationId) {
                    setSelectedAutomationId(null);
                    setActiveSurface("automations");
                  }
                }}
              />
            )}
            <CreateAutomationDialog
              open={createAutomationDialogOpen}
              onOpenChange={setCreateAutomationDialogOpen}
              snapshot={snapshot}
              disabled={!runtime.apiReady || runtime.busyAction === "automation"}
              onSubmit={(request) => void runtime.createAutomation(request)}
              onAddWorkspace={() => void runtime.pickWorkspaceDirectory?.().then((path) => {
                if (path) {
                  void runtime.rememberWorkspaceRoot(path);
                }
              })}
            />
            </div>
          </div>
        ) : marketplaceMode ? (
          <div data-spirit-surface="marketplace-layout" className={cn("flex min-h-0 min-w-0 flex-1 flex-col", desktopMicaTintInnerClass(useMicaBackdrop))}>
            <DesktopLayoutChromeBar
              useMicaBackdrop={useMicaBackdrop}
              showWorkspaceToggle={false}
            />
            <MarketplaceView
              useMicaBackdrop={useMicaBackdrop}
              snapshot={snapshot}
              apiReady={runtime.apiReady}
              busyAction={runtime.busyAction}
              runtimeError={runtime.runtimeError}
              onListMarketplaceExtensions={runtime.listMarketplaceExtensions}
              onGetMarketplaceExtensionDetail={runtime.getMarketplaceExtensionDetail}
              onGetMarketplaceExtensionReadme={runtime.getMarketplaceExtensionReadme}
              onPrepareMarketplaceExtensionInstall={runtime.prepareMarketplaceExtensionInstall}
              onInstallMarketplaceExtension={runtime.installMarketplaceExtension}
            />
          </div>
        ) : (
          <div data-spirit-surface="conversation-layout" className={cn("flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden min-w-0", desktopMicaTintInnerClass(useMicaBackdrop))}>
            <div data-spirit-surface="conversation-shell" className={cn("flex min-h-0 min-w-0 flex-1 flex-col min-w-0", desktopMicaTintInnerClass(useMicaBackdrop))}>
              <DesktopLayoutChromeBar
                useMicaBackdrop={useMicaBackdrop}
                showWorkspaceToggle
                workspaceToolsOpen={workspaceToolsOpen}
                onToggleWorkspaceTools={() => setWorkspaceToolsOpen((c) => !c)}
                sessionTitle={
                  isEmptySession || hideStaleConversationMessages
                    ? null
                    : snapshot?.activeSession?.displayName
                }
                subagentPromptText={
                  subagentViewActive ? snapshot?.subagentViewer?.promptText : null
                }
                onExitSubagentViewer={
                  subagentViewActive
                    ? () => {
                        void subagentViewer.close();
                      }
                    : undefined
                }
                onNewSession={isEmptySession ? undefined : handleNewSession}
                newSessionBusy={newSessionBusy}
              />
            <div data-spirit-surface="conversation-stage" className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col text-sm", desktopMicaTintClass(useMicaBackdrop))}>
              {compactionDemo.active ? (
                <div
                  data-spirit-surface="compaction-ui-demo-banner"
                  className={cn("shrink-0", desktopMicaTintInnerClass(useMicaBackdrop))}
                >
                  <div
                    className={cn(
                      "mx-auto flex w-full flex-wrap items-center justify-between gap-2 py-2",
                      CONVERSATION_GUTTER_X,
                      CONVERSATION_MAX_W,
                    )}
                  >
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{t('app.compactionDemo')}</span>
                      <span className="hidden sm:inline">
                        {" "}
                        · {t('app.compactionDemoDescription')}
                      </span>
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={compactionDemo.stop}>
                      {t('app.exitDemo')}
                    </Button>
                  </div>
                </div>
              ) : null}
              {rewindDraft ? (
                <button
                  type="button"
                  aria-label={t('app.cancelRewind')}
                  className="fixed inset-0 z-30 cursor-default bg-background/35 backdrop-blur-sm"
                  onClick={() => setRewindDraft(null)}
                />
              ) : null}
              <ScrollArea
                data-spirit-surface="conversation-scroll"
                className={cn("min-h-0 flex-1", desktopMicaTintInnerClass(useMicaBackdrop))}
                type="hover"
                scrollHideDelay={450}
              >
                {/* min-h-full：短内容仍铺满视口；pb ≥ dock 实测高度 + 留白，审批卡弹出时同步增高 */}
                <div
                  data-spirit-surface="conversation-scroll-body"
                  className={cn("min-h-full w-full", desktopMicaTintInnerClass(useMicaBackdrop))}
                  style={
                    (!isEmptySession || subagentViewActive) && !hideStaleConversationMessages
                      ? { paddingBottom: conversationScrollBedPaddingPx }
                      : undefined
                  }
                >
                  {(!isEmptySession || subagentViewActive) && !hideStaleConversationMessages ? (
                    <div
                      data-spirit-surface="conversation-list-shell"
                      className={cn(
                        "mx-auto w-full overflow-x-hidden pt-6 sm:pt-7",
                        CONVERSATION_GUTTER_X,
                        CONVERSATION_MAX_W,
                      )}
                    >
                      <ToolCallDiffHostProvider
                        value={{
                          workspaceRoot: snapshot?.workspaceRoot ?? "",
                          readWorkspaceTextFile: runtime.readWorkspaceTextFile,
                        }}
                      >
                      <div
                        key={`${composerSessionKey || "__no-session__"}:${conversationListScopeKey}:e${conversationListRemountEpoch}`}
                        data-spirit-surface="conversation-list"
                        className="space-y-3"
                      >
                        {subagentViewActive && messages.length === 0 ? (
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {t("app.subagentViewerEmpty")}
                          </p>
                        ) : null}
                        {conversationRenderItems.map((renderItem, renderIndex) => {
                          const previousRenderItem = conversationRenderItems[renderIndex - 1];

                          if (renderItem.kind === "process-group") {
                            const anchorMessage = messages[renderItem.messageIndices[0]];
                            if (!anchorMessage) {
                              return null;
                            }
                            const compactAfterPrevious = shouldCompactAfterPreviousRenderItem(
                              previousRenderItem,
                              anchorMessage,
                              messages,
                            );
                            const tightenAfterPreviousMeta = shouldTightenAfterPreviousRenderItem(
                              previousRenderItem,
                              anchorMessage,
                              messages,
                            );
                            return (
                              <div
                                key={renderItem.groupId}
                                id={renderItem.groupId}
                                data-spirit-surface="message-row"
                                data-spirit-message-role="assistant"
                                data-spirit-message-pending="false"
                                className={cn(
                                  "scroll-mt-4 flex w-full justify-start pb-3 last:pb-0",
                                  compactAfterPrevious && "-mt-4",
                                  tightenAfterPreviousMeta && "-mt-3",
                                )}
                              >
                                <div
                                  data-spirit-surface="message-assistant"
                                  className="min-w-0 w-full space-y-2"
                                >
                                  <ProcessCardCollapsible
                                    groupId={renderItem.groupId}
                                    messageIndices={renderItem.messageIndices}
                                    messages={messages}
                                    toolCounts={renderItem.toolCounts}
                                    pendingAuxState={conversationPendingAuxState}
                                    playSealAnimation={shouldPlayProcessSealAnimation(renderItem.groupId)}
                                    manualOpen={processGroupManualOpen[processGroupManualOpenKey(renderItem.groupId)]}
                                    onManualOpenChange={(open) => {
                                      setProcessGroupManualOpen((current) => ({
                                        ...current,
                                        [processGroupManualOpenKey(renderItem.groupId)]: open,
                                      }));
                                    }}
                                    renderToolBlock={(message) => (
                                      <ToolCallCollapsible
                                        tool={message.tool!}
                                        variant="process-nested"
                                        readLocalImagePreviewDataUrl={runtime.readLocalImagePreviewDataUrl}
                                        readLocalVideoPreviewUrl={runtime.readLocalVideoPreviewUrl}
                                        readManagedVideoPreviewUrl={runtime.readManagedVideoPreviewUrl}
                                        saveLocalImageAs={runtime.saveLocalImageAs}
                                        onOpenSubagentViewer={
                                          subagentViewActive ? undefined : handleOpenSubagentViewer
                                        }
                                        onAbortShell={(toolCallId) => {
                                          void runtime.abortShellCommand(toolCallId);
                                        }}
                                      />
                                    )}
                                    readManagedImagePreviewDataUrl={runtime.readManagedImagePreviewDataUrl}
                                    readManagedVideoPreviewUrl={runtime.readManagedVideoPreviewUrl}
                                  />
                                </div>
                              </div>
                            );
                          }

                          const index = renderItem.messageIndex;
                          const message = messages[index];
                          if (!message) {
                            return null;
                          }
                          const compactAfterPrevious = shouldCompactAfterPreviousRenderItem(
                            previousRenderItem,
                            message,
                            messages,
                          );
                          const tightenAfterPreviousMeta = shouldTightenAfterPreviousRenderItem(
                            previousRenderItem,
                            message,
                            messages,
                          );
                          const queuedBeforeCount = messages
                            .slice(0, index)
                            .filter((item) => item.queued === true).length;
                          const queuedCanMoveUp =
                            message.queued === true && queuedBeforeCount > 0;
                          const hiddenByProcessGroup = isMessageHiddenByProcessGroup(
                            conversationRenderItems,
                            index,
                          );
                          return (
                            <MessageCard
                              key={`${conversationMessageStableId(message, composerSessionKey, conversationListScopeKey)}@${index}`}
                              composerSessionKey={composerSessionKey}
                              conversationListScopeKey={conversationListScopeKey}
                              messages={messages}
                              pendingAuxState={conversationPendingAuxState}
                              listIndex={index}
                              message={message}
                              hiddenByProcessGroup={hiddenByProcessGroup}
                              compactAfterPrevious={compactAfterPrevious}
                              tightenAfterPreviousMeta={tightenAfterPreviousMeta}
                              showContinueButton={
                                turnContinue?.showContinueAtIndex === index &&
                                !activeSessionReadOnly &&
                                snapshot?.conversation.isBusy !== true
                              }
                              continueTarget={turnContinue?.continuableMessage}
                              continueBusy={continueBusy}
                              rewindSelected={rewindDraft?.listIndex === index}
                              rewindText={
                                rewindDraft?.listIndex === index ? rewindDraft.text : ""
                              }
                              rewindLocalFileAttachments={
                                rewindDraft?.listIndex === index
                                  ? rewindDraft.localFileAttachments
                                  : []
                              }
                              rewindBrowserElementAttachments={
                                rewindDraft?.listIndex === index
                                  ? rewindDraft.browserElementAttachments
                                  : []
                              }
                              rewindRichInputRef={rewindRichInputRef}
                              onRewindElementAttachmentsChange={(attachments) => {
                                setRewindDraft((current) =>
                                  current && current.listIndex === index
                                    ? { ...current, browserElementAttachments: attachments }
                                    : current,
                                );
                              }}
                              rewindCanSubmit={
                                messageRewindComposerEnabled &&
                                rewindDraft?.listIndex === index &&
                                (Boolean(rewindDraft.text.trim()) ||
                                  rewindDraft.browserElementAttachments.length > 0 ||
                                  rewindDraft.localFileAttachments.length > 0)
                              }
                              canPickLocalFile={runtime.hostKind === "electron"}
                              rewindBusy={runtime.busyAction === "rewind"}
                              models={models}
                              catalogHints={snapshot?.config.modelCatalogHints}
                              activeModel={runtime.settings.activeModel}
                              agentMode={runtime.settings.agentMode}
                              onContinue={(targetMessage) => {
                                void runtime.continueAssistantCompletion(targetMessage.id);
                              }}
                              onRewindStart={startMessageRewind}
                              onRewindChange={(value) => {
                                setRewindDraft((current) =>
                                  current ? { ...current, text: value } : current,
                                );
                              }}
                              onRewindSubmit={submitMessageRewind}
                              onRewindRemoveLocalFileAttachment={removeRewindLocalFileAttachment}
                              onRewindPickLocalFile={pickRewindLocalFileFromPalette}
                              onRewindPaste={handleRewindComposerPaste}
                              onModelSelect={runtime.setActiveModel}
                              onModelReasoningEffortSelect={runtime.setModelReasoningEffort}
                              onAgentModeChange={handleComposerAgentModeChange}
                              readManagedImagePreviewDataUrl={runtime.readManagedImagePreviewDataUrl}
                              readManagedVideoPreviewUrl={runtime.readManagedVideoPreviewUrl}
                              readLocalImagePreviewDataUrl={runtime.readLocalImagePreviewDataUrl}
                              readLocalVideoPreviewUrl={runtime.readLocalVideoPreviewUrl}
                              saveLocalImageAs={runtime.saveLocalImageAs}
                              onOpenSubagentViewer={
                                subagentViewActive ? undefined : handleOpenSubagentViewer
                              }
                              onAbortShell={(toolCallId) => {
                                void runtime.abortShellCommand(toolCallId);
                              }}
                              queuedCanMoveUp={queuedCanMoveUp}
                              queueActionBusy={runtime.busyAction === "send"}
                              onQueueMoveUp={(queueId) => {
                                void runtime.reorderQueuedUserTurn(queueId);
                              }}
                              onQueueSendNow={(queueId) => {
                                void runtime.sendQueuedUserTurnNow(queueId);
                              }}
                              onQueueDelete={(queueId) => {
                                void runtime.removeQueuedUserTurn(queueId);
                              }}
                            />
                          );
                        })}
                      </div>
                      </ToolCallDiffHostProvider>
                    </div>
                  ) : null}
                </div>
              </ScrollArea>

              <div
                ref={composerDockRef}
                data-spirit-surface="composer-dock"
                className={cn(
                  "pointer-events-none absolute inset-x-0 z-10 bg-transparent",
                  isEmptySession
                    ? cn(
                        "inset-y-0 flex items-center justify-center pb-[env(safe-area-inset-bottom,0px)]",
                        CONVERSATION_GUTTER_X,
                      )
                    : "bottom-0 pt-2 pb-0",
                )}
              >
                <div
                  className={cn(
                    "pointer-events-auto mx-auto w-full",
                    CONVERSATION_GUTTER_X,
                    CONVERSATION_MAX_W,
                  )}
                >
                {isEmptySession ? (
                  <div data-spirit-surface="conversation-empty">
                    <p
                      className="mb-6 text-center text-2xl font-medium tracking-tight text-foreground sm:text-3xl"
                      data-testid="empty-session-greeting"
                    >
                      {emptySessionGreeting}
                    </p>
                  </div>
                ) : null}
                <div className="space-y-2">
                {showWorkspaceBindingControls ? (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-0.5">
                    <EmptyStateWorkspaceSelector
                      currentWorkspaceRoot={snapshot?.workspaceRoot ?? ""}
                      workspaceBinding={snapshot?.workspaceBinding ?? "project"}
                      availableWorkspaces={snapshot?.availableWorkspaces ?? []}
                      disabled={runtime.busyAction === "bootstrap" || runtime.busyAction === "session"}
                      onSelectWorkspace={(workspaceRoot) => {
                        if (
                          snapshot?.workspaceBinding === "project"
                          && snapshot.workspaceRoot
                          && sameWorkspacePath(snapshot.workspaceRoot, workspaceRoot)
                        ) {
                          return;
                        }
                        void runtime.switchWorkspaceRoot(workspaceRoot);
                      }}
                      onSelectNoWorkspace={() => {
                        if (snapshot?.workspaceBinding === "none") {
                          return;
                        }
                        void runtime.switchToNoWorkspaceBinding();
                      }}
                      onAddWorkspace={() => {
                        void (async () => {
                          const workspaceRoot = await runtime.pickWorkspaceDirectory();
                          if (!workspaceRoot) {
                            return;
                          }
                          await runtime.rememberWorkspaceRoot(workspaceRoot);
                        })();
                      }}
                    />
                    {isEmptySession ? (
                    <>
                    <BranchSelectMenu
                      branches={snapshot?.git.branches ?? []}
                      selectedBranch={snapshot?.git.selectedBranch}
                      currentBranch={snapshot?.git.branch}
                      disabled={
                        runtime.busyAction === "bootstrap"
                        || runtime.busyAction === "session"
                        || commitBusy
                      }
                      onBranchChange={(branch) => {
                        void runtime.setPendingGitBranch(branch);
                      }}
                    />
                    <WorkLocationMenu
                      workLocation={snapshot?.git.workLocation ?? "local"}
                      disabled={
                        runtime.busyAction === "bootstrap"
                        || runtime.busyAction === "session"
                        || commitBusy
                        || snapshot?.git.isRepository !== true
                      }
                      onWorkLocationChange={(workLocation) => {
                        void runtime.setWorkLocation(workLocation);
                      }}
                    />
                    <ApprovalLevelMenu
                      approvalLevel={snapshot?.conversation.approvalLevel ?? "default"}
                      disabled={activeSessionReadOnly}
                      onApprovalLevelChange={(level) => {
                        void runtime.setApprovalLevel(level);
                      }}
                    />
                    </>
                    ) : null}
                  </div>
                ) : null}
                {runtime.runtimeError ? (
                  <div className="rounded-md border border-destructive/35 bg-destructive/10 px-2.5 py-2 text-xs leading-relaxed text-destructive">
                    {runtime.runtimeError}
                  </div>
                ) : null}

                {rewindWarnings.length > 0 ? (
                  <div className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2.5 py-2 text-xs leading-relaxed text-amber-900 dark:text-amber-100">
                    <p>{t('app.rewindComplete', { count: rewindWarnings.length })}</p>
                    <p className="mt-1 truncate" title={rewindWarnings[0]?.message}>
                      {rewindWarnings[0]?.path}: {rewindWarnings[0]?.message}
                    </p>
                  </div>
                ) : null}

                {showPendingApprovalInComposer && pendingApproval ? (
                  <PendingApprovalCard
                    pendingApproval={pendingApproval}
                    approvalGuidance={runtime.approvalGuidance}
                    approveBusy={runtime.busyAction === "approve"}
                    onApprovalGuidanceChange={runtime.setApprovalGuidance}
                    onSubmitApproval={(decision) => {
                      if (decision.kind === "allow") {
                        void runtime.submitApproval({
                          kind: "allow",
                          ...(decision.persistTrust ? { persistTrust: true } : {}),
                        });
                        return;
                      }
                      if (decision.kind === "deny") {
                        void runtime.submitApproval({ kind: "deny" });
                        return;
                      }
                      void runtime.submitApproval({
                        kind: "guidance",
                        userMessage: decision.userMessage ?? "",
                      });
                    }}
                  />
                ) : null}

                {showPendingQuestionsInComposer && pendingQuestions ? (
                  <PendingQuestionsCard
                    pendingQuestions={pendingQuestions}
                    questionDrafts={runtime.questionDrafts}
                    questionError={runtime.questionError}
                    questionsBusy={runtime.busyAction === "questions"}
                    onUpdateDraft={runtime.updateQuestionDraft}
                    onSubmitQuestions={() => void runtime.submitQuestions()}
                    onSkipQuestions={() => void runtime.skipQuestions()}
                  />
                ) : null}

                <div className="relative">
                <div className="relative z-10 flex flex-col">
                  {snapshot?.conversation.todos ? (
                    <div className="relative z-20 mx-4 -mb-px shrink-0">
                      <ComposerTodoCard
                        todos={snapshot.conversation.todos}
                        sessionKey={snapshot.composerSessionKey}
                      />
                    </div>
                  ) : null}
                  {fileReferenceSuggestions ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-full z-20 pb-2">
                      <div className="pointer-events-auto">
                        <WorkspaceFileReferenceMenu
                          suggestions={fileReferenceSuggestions.suggestions}
                          selectedIndex={fileReferenceSelectedIndex}
                          onSelectIndex={setFileReferenceSelectedIndex}
                          onApplySuggestion={applyFileReferenceSuggestion}
                        />
                      </div>
                    </div>
                  ) : null}
                  {slashQuery ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-full z-20 pb-2">
                      <div className="pointer-events-auto">
                        <SkillSlashMenu
                          suggestions={slashSuggestions}
                          selectedIndex={slashSelectedIndex}
                          onSelectIndex={setSlashSelectedIndex}
                          onApplySuggestion={applySlashSuggestionItem}
                        />
                      </div>
                    </div>
                  ) : null}
                  <ComposerSurface
                    value={runtime.composer}
                    onChange={runtime.setComposer}
                    onSubmit={submitComposerMessage}
                    browserElementAttachments={composerBrowserElementAttachments}
                    onElementAttachmentsChange={setComposerBrowserElementAttachments}
                    onAbort={() => void runtime.abortConversation()}
                    placeholder={composerPlaceholder}
                    localFileAttachments={runtime.composerLocalFileAttachments}
                    models={models}
                    catalogHints={snapshot?.config.modelCatalogHints}
                    activeModel={runtime.settings.activeModel}
                    agentMode={runtime.settings.agentMode}
                    loopEnabled={snapshot?.conversation.loopEnabled === true}
                    onModelSelect={runtime.setActiveModel}
                    onModelReasoningEffortSelect={runtime.setModelReasoningEffort}
                    onAgentModeChange={handleComposerAgentModeChange}
                    onLoopEnabledChange={(enabled) => {
                      void runtime.setLoopEnabled(enabled);
                    }}
                    richInputRef={composerRichInputRef}
                    onKeyDown={handleComposerKeyDown}
                    onSelectionChange={(selectionStart) => {
                      if (selectionStart !== null) {
                        setComposerCursorCodeUnits(selectionStart);
                      }
                    }}
                    canSend={composerCanSend}
                    canAbort={conversationInterruptible}
                    busy={runtime.busyAction === "send" && !conversationInterruptible}
                    conversationBusy={continueBusy}
                    agentModeChipDismissed={runtime.agentModeChipDismissed}
                    onAgentModeChipDismissChange={runtime.setAgentModeChipDismissed}
                    readOnly={activeSessionReadOnly}
                    showInsertButton
                    canPickLocalFile={runtime.hostKind === "electron"}
                    onInsertWorkspaceFileReferenceTrigger={insertFileReferenceTrigger}
                    onPickLocalFile={pickLocalFileFromPalette}
                    onInsertSkillTrigger={insertSkillTriggerFromPalette}
                    onRemoveLocalFileAttachment={removeLocalFileAttachment}
                    onPaste={handleComposerPaste}
                  />
                </div>
                  {!isEmptySession ? (
                    <div
                      className={cn(
                        "pointer-events-none relative z-0 -mt-4 pt-[calc(1rem+0.375rem)] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]",
                        desktopMicaTintInnerClass(useMicaBackdrop),
                        CONVERSATION_GUTTER_NEG_X,
                        CONVERSATION_GUTTER_X,
                      )}
                    >
                      <div className="pointer-events-auto relative z-[11] flex items-center justify-between gap-3 px-3">
                        <ApprovalLevelMenu
                          approvalLevel={snapshot?.conversation.approvalLevel ?? "default"}
                          disabled={activeSessionReadOnly}
                          onApprovalLevelChange={(level) => {
                            void runtime.setApprovalLevel(level);
                          }}
                        />
                        <ComposerContextUsageRing
                          usage={snapshot?.conversation.contextUsage}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
                </div>
                </div>
              </div>
            </div>
            </div>
            <div data-spirit-surface="workspace-dock">
            <WorkspaceToolsDock
              useMicaBackdrop={useMicaBackdrop}
              workspaceRoot={snapshot?.workspaceRoot ?? ""}
              listExplorerChildren={runtime.listWorkspaceExplorerChildren}
              readWorkspaceTextFile={runtime.readWorkspaceTextFile}
              writeWorkspaceTextFile={runtime.writeWorkspaceTextFile}
              readHostTextFile={runtime.readHostTextFile}
              writeHostTextFile={runtime.writeHostTextFile}
              readManagedImagePreviewDataUrl={runtime.readManagedImagePreviewDataUrl}
              plan={snapshot?.plan ?? { path: "", exists: false }}
              onStartImplementing={() => {
                handleComposerAgentModeChange("agent");
                void runtime.submitStartImplementing();
              }}
              startImplementingDisabled={
                startImplementingDisabled || !snapshot?.plan?.exists
              }
              autoRevealPlanNonce={workspaceFilesPlanRevealNonce}
              planRevealTabId={workspaceFilesPlanRevealTargetId}
              autoRevealFileNonce={workspaceFileRevealNonce}
              fileRevealTabId={workspaceFileRevealTargetId}
              fileRevealPath={workspaceFileRevealPath}
              fileRevealAbsolutePath={workspaceFileRevealAbsolutePath}
              fileRevealScope={workspaceFileRevealScope}
              fileRevealViewMode={workspaceFileRevealViewMode}
              onOpenWorkspaceFile={openWorkspaceFile}
              tabs={workspaceToolTabs}
              activeTabId={activeWorkspaceToolTabId}
              onTabsChange={setWorkspaceToolTabs}
              onActiveTabIdChange={setActiveWorkspaceToolTabId}
              onBrowserElementPicked={handleBrowserElementPicked}
              onBrowserOpenInNewTab={openBrowserUrlInNewTab}
              browserTabEnabled={browserTabEnabled}
              open={workspaceToolsOpen}
              widthPx={workspaceToolsWidthPx}
              onWidthPxChange={setWorkspaceToolsWidthPx}
              gitSnapshot={snapshot?.git}
              gitChipBusy={gitChipBusy}
              readGitWorkingTree={runtime.readGitWorkingTree}
              readGitHistory={runtime.readGitHistory}
              submitGitChip={runtime.submitGitChip}
            />
            </div>
          </div>
        )}
        </div>
      </div>

      <ActionPickerDialog
        open={actionPickerOpen}
        onOpenChange={setActionPickerOpen}
        onSelect={runActionPaletteItem}
        isItemDisabled={isActionPaletteItemDisabled}
      />

      <WorkspaceFilePickerDialog
        open={filePickerOpen}
        onOpenChange={setFilePickerOpen}
        workspaceRoot={snapshot?.workspaceRoot ?? ''}
        workspaceBinding={snapshot?.workspaceBinding ?? 'project'}
        onOpenWorkspaceFile={(relativePath) => {
          openWorkspaceFile(relativePath, {
            viewMode: isMarkdownPath(relativePath) ? "preview" : "edit",
          });
        }}
        onOpenExternalFile={(absolutePath) => {
          openEditorFile({
            scope: "external",
            absolutePath,
            viewMode: isMarkdownPath(absolutePath) ? "preview" : "edit",
          });
        }}
        statHostTextFile={runtime.statHostTextFile}
        indexReady={workspaceFileIndex.ready}
        searchWorkspaceFiles={workspaceFileIndex.search}
      />

      <Dialog
        open={branchCheckoutDialogOpen}
        onOpenChange={(open) => {
          setBranchCheckoutDialogOpen(open);
          if (!open) {
            pendingComposerSendRef.current = null;
            setBranchCheckoutBlockedByChanges(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>
              {branchCheckoutBlockedByChanges ? t('app.cannotSwitchBranch') : t('app.switchBranch')}
            </DialogTitle>
            <DialogDescription>
              {branchCheckoutBlockedByChanges ? (
                <>
                  {t('app.uncommittedChangesCannotSwitch', { branch: snapshot?.git.selectedBranch ?? snapshot?.git.branch ?? '' })}
                  {t('app.discardChangesWarning')}
                </>
              ) : (
                <>
                  {t('app.willSwitchBranch', { branch: snapshot?.git.selectedBranch ?? snapshot?.git.branch ?? '' })}
                  {snapshot?.git.hasChanges
                    ? ` ${t('app.uncommittedChangesMayFail')}`
                    : null}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {runtime.runtimeError ? (
            <p className="text-sm leading-relaxed text-destructive">{runtime.runtimeError}</p>
          ) : null}
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                pendingComposerSendRef.current = null;
                setBranchCheckoutBlockedByChanges(false);
                setBranchCheckoutDialogOpen(false);
              }}
              disabled={commitBusy}
            >
              {t('common.cancel')}
            </Button>
            {branchCheckoutBlockedByChanges ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={discardBranchChangesAndCheckoutSend}
                disabled={commitBusy}
              >
                {commitBusy ? <LoaderCircle className="size-4 animate-spin" /> : null}
                {t('app.discardAndSwitch')}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={confirmBranchCheckoutAndSend}
                disabled={commitBusy}
              >
                {commitBusy ? <LoaderCircle className="size-4 animate-spin" /> : null}
                {t('app.switchAndSend')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
    </SessionSidebarChromeProvider>
  );
}

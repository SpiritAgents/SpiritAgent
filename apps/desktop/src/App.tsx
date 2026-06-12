import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

import { modelReasoningEffortLabel } from "@spirit-agent/core/reasoning-effort";

import {
  SessionSidebarChromeProvider,
  type SessionSidebarChromeApi,
  useSessionSidebarChrome,
} from "@/contexts/session-sidebar-chrome-context";
import {
  pickEmptySessionGreetingVariant,
  resolveEmptySessionGreeting,
  type EmptySessionGreetingVariantId,
} from "@/lib/empty-session-greeting";
import { resolveWorkspaceDisplayLabel } from "@/lib/workspace-display-label";

import {
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  Download,
  FolderPlus,
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
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { SettingsView } from "@/components/settings-view";
import { MinimalToolCallCard } from "@/components/minimal-tool-call-card";
import { SessionChromeBreadcrumb } from "@/components/session-chrome-breadcrumb";
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
} from "@/lib/message-card-spacing";
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
import { useComposerController } from "@/hooks/useComposerController";
import { useMessageRewind } from "@/hooks/useMessageRewind";
import { useClickablePointerCursor } from "@/hooks/useClickablePointerCursor";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { isManagedGeneratedVideoRef } from "@/lib/managed-generated-asset";
import {
  isPreviewableImagePath,
  isPreviewableVideoPath,
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
  DesktopSnapshot,
  PendingAssistantAux,
  ToolBlockSnapshot,
} from "@/types";
import { BranchCheckoutDialog } from "@/components/branch-checkout-dialog";

import { resolveConversationListScopeKey } from "@/lib/conversation-list-scope";

/** 主会话列最大宽度（居中） */

import {
  CONVERSATION_COMPOSER_SCROLL_BED_FALLBACK_PX,
  CONVERSATION_SCROLL_BED_EXTRA_PX,
} from "@/lib/conversation-layout-constants";
import { ConversationView } from "@/components/conversation/conversation-view";
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

  const activeSessionReadOnly = snapshot?.activeSession?.readOnly === true;
  const conversationInterruptible = runtime.summary.canInterrupt && !runtime.busyAction;
  const continueBusy = Boolean(runtime.busyAction) || snapshot?.conversation.isBusy === true;
  const conversationAbortShortcutEligible =
    conversationInterruptible && !activeSessionReadOnly;
  const conversationAbortShortcutEligibleRef = useRef(false);
  conversationAbortShortcutEligibleRef.current = conversationAbortShortcutEligible;
  const startImplementingDisabled =
    !snapshot?.runtimeReady ||
    activeSessionReadOnly ||
    runtime.busyAction === "session" ||
    Boolean(pendingApproval) ||
    Boolean(pendingQuestions) ||
    (runtime.busyAction === "send" && !conversationInterruptible);
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

  const activeFilePath = snapshot?.activeSession?.filePath ?? null;

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

  const composer = useComposerController({
    runtime,
    snapshot,
    t,
    isEmptySession,
    activeSessionReadOnly,
    compactionDemoActive: compactionDemo.active,
    subagentViewActive,
    pendingApproval,
    pendingQuestions,
    conversationInterruptible,
    handleNewSession,
    setActiveSurface,
    setLastNonSettingsSurface,
  });

  const messageRewind = useMessageRewind({
    runtime,
    messages,
    subagentViewer,
    messageRewindComposerEnabled: composer.messageRewindComposerEnabled,
    activeSessionReadOnly,
  });

  const handleGenerateAutomation = useCallback(async () => {
    setLastNonSettingsSurface("conversation");
    setActiveSurface("conversation");
    const seed = t("automations.generateComposerSeed");
    const resetOk = await runtime.resetSession();
    if (!resetOk) {
      return;
    }
    runtime.setComposer(seed);
    composer.setSlashSelectedIndex(-1);
    queueMicrotask(() => {
      composer.focusComposer();
    });
  }, [composer, runtime, t]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (!isModShortcutPressed(event) || event.key.toLowerCase() !== "p") {
        return;
      }
      event.preventDefault();
      if (event.shiftKey) {
        composer.setActionPickerOpen(true);
        return;
      }
      composer.setFilePickerOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [composer.setActionPickerOpen, composer.setFilePickerOpen]);

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
                composer.prefillComposerSkillChip("create-skill");
              }}
              onGenerateRuleNavigate={() => {
                composer.prefillComposerSkillChip("create-rule");
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
          <ConversationView
            useMicaBackdrop={useMicaBackdrop}
            workspaceToolsOpen={workspaceToolsOpen}
            onToggleWorkspaceTools={() => setWorkspaceToolsOpen((c) => !c)}
            isEmptySession={isEmptySession}
            hideStaleConversationMessages={hideStaleConversationMessages}
            snapshot={snapshot}
            subagentViewActive={subagentViewActive}
            onExitSubagentViewer={
              subagentViewActive
                ? () => {
                    void subagentViewer.close();
                  }
                : undefined
            }
            onNewSession={handleNewSession}
            newSessionBusy={newSessionBusy}
            compactionDemoActive={compactionDemo.active}
            onCompactionDemoStop={compactionDemo.stop}
            rewindDraft={messageRewind.rewindDraft}
            onRewindDraftClear={() => messageRewind.setRewindDraft(null)}
            conversationScrollBedPaddingPx={conversationScrollBedPaddingPx}
            composerDockRef={composerDockRef}
            messages={messages}
            conversationRenderItems={conversationRenderItems}
            composerSessionKey={composerSessionKey}
            conversationListScopeKey={conversationListScopeKey}
            conversationListRemountEpoch={conversationListRemountEpoch}
            conversationPendingAuxState={conversationPendingAuxState}
            processGroupManualOpen={processGroupManualOpen}
            processGroupManualOpenKey={processGroupManualOpenKey}
            onProcessGroupManualOpenChange={(groupId, open) => {
              setProcessGroupManualOpen((current) => ({
                ...current,
                [processGroupManualOpenKey(groupId)]: open,
              }));
            }}
            shouldPlayProcessSealAnimation={shouldPlayProcessSealAnimation}
            runtime={runtime}
            turnContinue={turnContinue}
            activeSessionReadOnly={activeSessionReadOnly}
            continueBusy={continueBusy}
            onRewindDraftChange={messageRewind.setRewindDraft}
            messageRewindComposerEnabled={composer.messageRewindComposerEnabled}
            rewindRichInputRef={messageRewind.rewindRichInputRef}
            models={models}
            onOpenSubagentViewer={subagentViewActive ? undefined : handleOpenSubagentViewer}
            onStartMessageRewind={messageRewind.startMessageRewind}
            onSubmitMessageRewind={messageRewind.submitMessageRewind}
            onRewindRemoveLocalFileAttachment={messageRewind.removeRewindLocalFileAttachment}
            onRewindPickLocalFile={messageRewind.pickRewindLocalFileFromPalette}
            onRewindPaste={messageRewind.handleRewindComposerPaste}
            onComposerAgentModeChange={composer.handleComposerAgentModeChange}
            emptySessionGreeting={emptySessionGreeting}
            showWorkspaceBindingControls={showWorkspaceBindingControls}
            commitBusy={composer.commitBusy}
            rewindWarnings={rewindWarnings}
            showPendingApprovalInComposer={showPendingApprovalInComposer}
            pendingApproval={pendingApproval}
            showPendingQuestionsInComposer={showPendingQuestionsInComposer}
            fileReferenceSuggestions={composer.fileReferenceSuggestions}
            fileReferenceSelectedIndex={composer.fileReferenceSelectedIndex}
            onFileReferenceSelectedIndexChange={composer.setFileReferenceSelectedIndex}
            onApplyFileReferenceSuggestion={composer.applyFileReferenceSuggestion}
            slashQuery={composer.slashQuery}
            slashSuggestions={composer.slashSuggestions}
            slashSelectedIndex={composer.slashSelectedIndex}
            onSlashSelectedIndexChange={composer.setSlashSelectedIndex}
            onApplySlashSuggestionItem={composer.applySlashSuggestionItem}
            composerPlaceholder={composer.composerPlaceholder}
            composerCanSend={composer.composerCanSend}
            conversationInterruptible={conversationInterruptible}
            composerBrowserElementAttachments={composer.composerBrowserElementAttachments}
            onComposerBrowserElementAttachmentsChange={composer.setComposerBrowserElementAttachments}
            onSubmitComposerMessage={composer.submitComposerMessage}
            composerRichInputRef={composer.composerRichInputRef}
            onComposerKeyDown={composer.handleComposerKeyDown}
            onComposerCursorCodeUnitsChange={composer.setComposerCursorCodeUnits}
            onInsertFileReferenceTrigger={composer.insertFileReferenceTrigger}
            onPickLocalFileFromPalette={composer.pickLocalFileFromPalette}
            onInsertSkillTriggerFromPalette={composer.insertSkillTriggerFromPalette}
            onRemoveLocalFileAttachment={composer.removeLocalFileAttachment}
            onComposerPaste={composer.handleComposerPaste}
            startImplementingDisabled={startImplementingDisabled}
            workspaceFilesPlanRevealNonce={workspaceFilesPlanRevealNonce}
            workspaceFilesPlanRevealTargetId={workspaceFilesPlanRevealTargetId}
            workspaceFileRevealNonce={workspaceFileRevealNonce}
            workspaceFileRevealTargetId={workspaceFileRevealTargetId}
            workspaceFileRevealPath={workspaceFileRevealPath}
            workspaceFileRevealAbsolutePath={workspaceFileRevealAbsolutePath}
            workspaceFileRevealScope={workspaceFileRevealScope}
            workspaceFileRevealViewMode={workspaceFileRevealViewMode}
            onOpenWorkspaceFile={openWorkspaceFile}
            workspaceToolTabs={workspaceToolTabs}
            activeWorkspaceToolTabId={activeWorkspaceToolTabId}
            onWorkspaceToolTabsChange={setWorkspaceToolTabs}
            onActiveWorkspaceToolTabIdChange={setActiveWorkspaceToolTabId}
            onBrowserElementPicked={composer.handleBrowserElementPicked}
            onBrowserOpenInNewTab={openBrowserUrlInNewTab}
            browserTabEnabled={browserTabEnabled}
            workspaceToolsWidthPx={workspaceToolsWidthPx}
            onWorkspaceToolsWidthPxChange={setWorkspaceToolsWidthPx}
            gitChipBusy={composer.gitChipBusy}
          />
        )}
        </div>
      </div>

      <ActionPickerDialog
        open={composer.actionPickerOpen}
        onOpenChange={composer.setActionPickerOpen}
        onSelect={composer.runActionPaletteItem}
        isItemDisabled={composer.isActionPaletteItemDisabled}
      />

      <WorkspaceFilePickerDialog
        open={composer.filePickerOpen}
        onOpenChange={composer.setFilePickerOpen}
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
        indexReady={composer.workspaceFileIndex.ready}
        searchWorkspaceFiles={composer.workspaceFileIndex.search}
      />

      <BranchCheckoutDialog
        open={composer.branchCheckoutDialogOpen}
        onOpenChange={composer.handleBranchCheckoutDialogOpenChange}
        branchCheckoutBlockedByChanges={composer.branchCheckoutBlockedByChanges}
        git={snapshot?.git}
        runtimeError={runtime.runtimeError}
        commitBusy={composer.commitBusy}
        onCancel={composer.cancelBranchCheckoutDialog}
        onConfirmCheckout={composer.confirmBranchCheckoutAndSend}
        onDiscardAndCheckout={composer.discardBranchChangesAndCheckoutSend}
      />

    </div>
    </SessionSidebarChromeProvider>
  );
}

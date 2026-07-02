import { useMemo, useEffect } from "react";
import type { TFunction } from "i18next";

import type {
  ComposerDockSectionProps,
  ConversationListSectionProps,
} from "@/components/conversation/conversation-view";
import { useComposerController } from "@/hooks/useComposerController";
import { useConversationViewState } from "@/hooks/useConversationViewState";
import type { useDesktopRuntime } from "@/hooks/useDesktopRuntime";
import { useMessageRewind } from "@/hooks/useMessageRewind";
import type { useSubagentViewer } from "@/hooks/useSubagentViewer";
import type { useCompactionUiDemo } from "@/hooks/useCompactionUiDemo";
import type { useWorkspaceToolsController } from "@/hooks/useWorkspaceToolsController";
import { resolveEffectiveEmptySession } from "@/lib/conversation-surface-stale";
import { resolvePaneDesktopSnapshot, lookupPaneSessionSlice } from "@/lib/pane-desktop-snapshot";
import type { EditorFileTarget } from "@/lib/workspace-editor-navigation";
import type { ConversationAbortShortcutTargetRef } from "@/lib/conversation-abort-shortcut";
import type { DesktopSnapshot } from "@/types";

type DesktopRuntime = ReturnType<typeof useDesktopRuntime>;
type SubagentViewer = ReturnType<typeof useSubagentViewer>;
type CompactionDemo = ReturnType<typeof useCompactionUiDemo>;
type WorkspaceTools = ReturnType<typeof useWorkspaceToolsController>;

export type UseConversationPaneControllerOptions = {
  runtime: DesktopRuntime;
  baseSnapshot: DesktopSnapshot | null;
  sessionPath: string;
  isFocused: boolean;
  isAnchorPane: boolean;
  useIsolatedPane: boolean;
  subagentViewActive: boolean;
  subagentViewer: SubagentViewer;
  compactionDemo: CompactionDemo;
  hideStaleConversationMessages: boolean;
  showWorkspaceBindingControls: boolean;
  sessionNavigationBusy: boolean;
  newSessionBusy: boolean;
  splitPaneCount: number;
  layoutNavigationPending: boolean;
  onNewSession?: () => void;
  workspaceTools: WorkspaceTools;
  onOpenIntegrationsSettings: () => void;
  t: TFunction;
  language: string;
  conversationAbortShortcutTargetRef?: ConversationAbortShortcutTargetRef;
};

export function useConversationPaneController({
  runtime,
  baseSnapshot,
  sessionPath,
  isFocused,
  isAnchorPane,
  useIsolatedPane,
  subagentViewActive,
  subagentViewer,
  compactionDemo,
  hideStaleConversationMessages,
  showWorkspaceBindingControls,
  sessionNavigationBusy,
  newSessionBusy,
  splitPaneCount,
  layoutNavigationPending,
  onNewSession,
  workspaceTools,
  onOpenIntegrationsSettings,
  t,
  language,
  conversationAbortShortcutTargetRef,
}: UseConversationPaneControllerOptions) {
  const paneSnapshot = useMemo(
    () => resolvePaneDesktopSnapshot(baseSnapshot, sessionPath),
    [baseSnapshot, sessionPath],
  );

  const paneSubagentViewActive = isFocused && subagentViewActive;
  const paneCompactionDemoActive = isFocused && compactionDemo.active;

  const paneMissingSliceDuringNav = useMemo(() => {
    if (!layoutNavigationPending || splitPaneCount <= 1) {
      return false;
    }
    const hasPaneSessions = Boolean(
      baseSnapshot?.paneSessions && Object.keys(baseSnapshot.paneSessions).length > 0,
    );
    return hasPaneSessions && !lookupPaneSessionSlice(baseSnapshot, sessionPath);
  }, [baseSnapshot, layoutNavigationPending, sessionPath, splitPaneCount]);

  const paneHideStaleConversationMessages = useMemo(
    () => (isFocused ? hideStaleConversationMessages : false) || paneMissingSliceDuringNav,
    [hideStaleConversationMessages, isFocused, paneMissingSliceDuringNav],
  );

  const paneIsEmptySession = useMemo(
    () => {
      if (paneMissingSliceDuringNav) {
        return false;
      }
      return resolveEffectiveEmptySession({
        sessionMessageCount: paneSnapshot?.conversation.messages.length ?? 0,
        subagentViewActive: paneSubagentViewActive,
        compactionDemoActive: paneCompactionDemoActive,
        newSessionBusy: isFocused && splitPaneCount <= 1 ? newSessionBusy : false,
      });
    },
    [
      isFocused,
      newSessionBusy,
      paneCompactionDemoActive,
      paneMissingSliceDuringNav,
      paneSnapshot?.conversation.messages.length,
      paneSubagentViewActive,
      splitPaneCount,
    ],
  );

  const paneShowWorkspaceBindingControls =
    (useIsolatedPane || isAnchorPane) && paneIsEmptySession;


  const conversation = useConversationViewState({
    runtime,
    snapshot: paneSnapshot,
    subagentViewActive: paneSubagentViewActive,
    subagentViewer,
    compactionDemo: {
      ...compactionDemo,
      active: paneCompactionDemoActive,
    },
    t,
    language,
    useIsolatedPane,
    conversationAbortShortcutTargetRef,
  });

  useEffect(() => {
    const ref = conversationAbortShortcutTargetRef;
    if (!ref || !isFocused || splitPaneCount <= 1) {
      return;
    }
    ref.current = {
      eligible: conversation.conversationInterruptible && !conversation.activeSessionReadOnly,
      sessionPath: useIsolatedPane ? sessionPath : undefined,
    };
    return () => {
      if (ref.current.sessionPath === sessionPath || !useIsolatedPane) {
        ref.current = { eligible: false };
      }
    };
  }, [
    conversation.activeSessionReadOnly,
    conversation.conversationInterruptible,
    conversationAbortShortcutTargetRef,
    isFocused,
    sessionPath,
    splitPaneCount,
    useIsolatedPane,
  ]);

  const composer = useComposerController({
    runtime,
    snapshot: paneSnapshot,
    t,
    isEmptySession: paneIsEmptySession,
    activeSessionReadOnly: conversation.activeSessionReadOnly,
    compactionDemoActive: paneCompactionDemoActive,
    subagentViewActive: paneSubagentViewActive,
    pendingApproval: conversation.pendingApproval,
    pendingQuestions: conversation.pendingQuestions,
    conversationInterruptible: conversation.conversationInterruptible,
    handleNewSession: onNewSession ?? (() => {}),
    setActiveSurface: () => {},
    setLastNonSettingsSurface: () => {},
    paneSessionPath: useIsolatedPane ? sessionPath : undefined,
  });

  const messageRewind = useMessageRewind({
    runtime,
    messages: conversation.messages,
    subagentViewer,
    messageRewindComposerEnabled: composer.messageRewindComposerEnabled,
    activeSessionReadOnly: conversation.activeSessionReadOnly,
  });


  const list: ConversationListSectionProps = {
    messages: conversation.messages,
    conversationRenderItems: conversation.conversationRenderItems,
    composerSessionKey: conversation.composerSessionKey,
    conversationListScopeKey: conversation.conversationListScopeKey,
    conversationListRemountEpoch: conversation.conversationListRemountEpoch,
    conversationPendingAuxState: conversation.conversationPendingAuxState,
    processGroupManualOpen: conversation.processGroupManualOpen,
    processGroupManualOpenKey: conversation.processGroupManualOpenKey,
    onProcessGroupManualOpenChange: (groupId, open) => {
      conversation.setProcessGroupManualOpen((current) => ({
        ...current,
        [conversation.processGroupManualOpenKey(groupId)]: open,
      }));
    },
    shouldPlayProcessSealAnimation: conversation.shouldPlayProcessSealAnimation,
    runtime,
    turnContinue: conversation.turnContinue,
    activeSessionReadOnly: conversation.activeSessionReadOnly,
    continueBusy: conversation.continueBusy,
    rewindDraft: messageRewind.rewindDraft,
    onRewindDraftChange: messageRewind.setRewindDraft,
    messageRewindComposerEnabled: composer.messageRewindComposerEnabled,
    rewindRichInputRef: messageRewind.rewindRichInputRef,
    models: conversation.models,
    onOpenSubagentViewer: paneSubagentViewActive ? undefined : conversation.handleOpenSubagentViewer,
    onOpenReadFile: (target: EditorFileTarget) => {
      workspaceTools.openEditorFile(target);
    },
    onStartMessageRewind: messageRewind.startMessageRewind,
    onForkMessage: (message, listIndex) => {
      void runtime.forkSession({ messageId: message.id, listIndex });
    },
    onSubmitMessageRewind: messageRewind.submitMessageRewind,
    onRewindRemoveLocalFileAttachment: messageRewind.removeRewindLocalFileAttachment,
    onRewindPickLocalFile: messageRewind.pickRewindLocalFileFromPalette,
    onRewindPaste: messageRewind.handleRewindComposerPaste,
    onRewindDragOver: messageRewind.handleRewindComposerDragOver,
    onRewindDrop: messageRewind.handleRewindComposerDrop,
    onComposerAgentModeChange: composer.handleComposerAgentModeChange,
  };

  const composerDock: ComposerDockSectionProps = {
    composerDockRef: conversation.composerDockRef,
    composerInitialSegments: composer.composerInitialSegments,
    emptySessionGreeting: conversation.emptySessionGreeting,
    showWorkspaceBindingControls: paneShowWorkspaceBindingControls,
    paneSessionPath: useIsolatedPane ? sessionPath : undefined,
    useIsolatedPaneWorkspace: useIsolatedPane,
    composerText: composer.composerText,
    onComposerTextChange: composer.setComposerText,
    composerLocalFileAttachments: composer.composerLocalFileAttachments,
    onComposerLocalFileAttachmentsChange: composer.setComposerLocalFileAttachments,
    commitBusy: composer.commitBusy,
    rewindWarnings: conversation.rewindWarnings,
    showPendingApprovalInComposer: conversation.showPendingApprovalInComposer,
    pendingApproval: conversation.pendingApproval,
    showPendingQuestionsInComposer: conversation.showPendingQuestionsInComposer,
    pendingQuestions: conversation.pendingQuestions,
    fileReferenceSuggestions: composer.fileReferenceSuggestions,
    fileReferenceSelectedIndex: composer.fileReferenceSelectedIndex,
    onFileReferenceSelectedIndexChange: composer.setFileReferenceSelectedIndex,
    onApplyFileReferenceSuggestion: composer.applyFileReferenceSuggestion,
    onDismissFileReferenceSuggestions: composer.dismissFileReferenceSuggestions,
    activeFileReferenceQuery: composer.activeFileReferenceQuery,
    slashQuery: composer.slashQuery,
    slashSuggestions: composer.slashSuggestions,
    slashSelectedIndex: composer.slashSelectedIndex,
    onSlashSelectedIndexChange: composer.setSlashSelectedIndex,
    onApplySlashSuggestionItem: composer.applySlashSuggestionItem,
    onDismissSlashSuggestions: composer.dismissSlashSuggestions,
    composerCursorCodeUnits: composer.composerCursorCodeUnits,
    composerPlaceholder: composer.composerPlaceholder,
    composerAgentModeChipPlaceholder: composer.composerAgentModeChipPlaceholder,
    composerCanSend: composer.composerCanSend,
    composerHasPayload: composer.composerHasPayload,
    composerBusy: composer.composerBusy,
    conversationInterruptible: conversation.conversationInterruptible,
    composerBrowserElementAttachments: composer.composerBrowserElementAttachments,
    onComposerBrowserElementAttachmentsChange: composer.setComposerBrowserElementAttachments,
    onSubmitComposerMessage: composer.submitComposerMessage,
    onComposerAgentModeChange: composer.handleComposerAgentModeChange,
    composerRichInputRef: composer.composerRichInputRef,
    onComposerKeyDown: composer.handleComposerKeyDown,
    onComposerCursorCodeUnitsChange: composer.setComposerCursorCodeUnits,
    onInsertFileReferenceTrigger: composer.insertFileReferenceTrigger,
    onPickLocalFileFromPalette: composer.pickLocalFileFromPalette,
    onInsertSkillTriggerFromPalette: composer.insertSkillTriggerFromPalette,
    onRemoveLocalFileAttachment: composer.removeLocalFileAttachment,
    onComposerPaste: composer.handleComposerPaste,
    onComposerDragOver: composer.handleComposerDragOver,
    onComposerDrop: composer.handleComposerDrop,
    onComposerSegmentsCommit: composer.handleComposerSegmentsCommit,
    models: conversation.models,
    onOpenGitTab: workspaceTools.openGitTab,
  };

  const composerInsertHandlers = useMemo(
    () => ({
      handleBrowserElementPicked: composer.handleBrowserElementPicked,
      handlePrDiffAddToSession: composer.handlePrDiffAddToSession,
      handleGitCommitAddToSession: composer.handleGitCommitAddToSession,
      handleTerminalAddToSession: composer.handleTerminalAddToSession,
      handleFileSnippetAddToSession: composer.handleFileSnippetAddToSession,
      handleWorkspaceFileAddToSession: composer.handleWorkspaceFileAddToSession,
    }),
    [
      composer.handleBrowserElementPicked,
      composer.handleFileSnippetAddToSession,
      composer.handleGitCommitAddToSession,
      composer.handlePrDiffAddToSession,
      composer.handleTerminalAddToSession,
      composer.handleWorkspaceFileAddToSession,
    ],
  );

  return {
    paneSnapshot,
    paneIsEmptySession,
    hideStaleConversationMessages: paneHideStaleConversationMessages,
    list,
    composerDock,
    conversationScrollBedPaddingPx: conversation.conversationScrollBedPaddingPx,
    rewindDraft: messageRewind.rewindDraft,
    onRewindDraftClear: () => messageRewind.setRewindDraft(null),
    onExitSubagentViewer: paneSubagentViewActive
      ? () => {
          void subagentViewer.close();
        }
      : undefined,
    subagentViewActive: paneSubagentViewActive,
    compactionDemoActive: paneCompactionDemoActive,
    composerInsertHandlers,
  };
}

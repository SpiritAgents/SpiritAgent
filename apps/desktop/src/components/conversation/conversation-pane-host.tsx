import { useCallback, useEffect } from "react";

import { ConversationView } from "@/components/conversation/conversation-view";
import { useConversationSplit } from "@/contexts/conversation-split-context";
import { useConversationPaneController } from "@/hooks/useConversationPaneController";
import type { useCompactionUiDemo } from "@/hooks/useCompactionUiDemo";
import type { useDesktopRuntime } from "@/hooks/useDesktopRuntime";
import type { useSubagentViewer } from "@/hooks/useSubagentViewer";
import type { useWorkspaceToolsController } from "@/hooks/useWorkspaceToolsController";
import type { PaneDropZone } from "@/lib/conversation-split-layout";
import type { DesktopSnapshot } from "@/types";
import type { TFunction } from "i18next";

type DesktopRuntime = ReturnType<typeof useDesktopRuntime>;
type SubagentViewer = ReturnType<typeof useSubagentViewer>;
type CompactionDemo = ReturnType<typeof useCompactionUiDemo>;
type WorkspaceTools = ReturnType<typeof useWorkspaceToolsController>;

export type ConversationPaneHostProps = {
  runtime: DesktopRuntime;
  baseSnapshot: DesktopSnapshot | null;
  sessionPath: string;
  paneId: string;
  isFocused: boolean;
  isAnchorPane: boolean;
  isSessionSidebarAnchorPane: boolean;
  useIsolatedPane: boolean;
  splitPaneCount: number;
  onFocusPane: () => void;
  onSplit: () => void;
  onSplitVertical: () => void;
  onClosePane: () => void;
  showClosePane: boolean;
  useMicaBackdrop: boolean;
  subagentViewActive: boolean;
  subagentViewer: SubagentViewer;
  compactionDemo: CompactionDemo;
  hideStaleConversationMessages: boolean;
  showWorkspaceBindingControls: boolean;
  sessionNavigationBusy: boolean;
  newSessionBusy: boolean;
  onNewSession?: () => void;
  deleteSessionBusy?: boolean;
  onDeleteSession?: (path: string) => void | Promise<void>;
  workspaceTools: WorkspaceTools;
  onOpenIntegrationsSettings: () => void;
  onCompactionDemoStop: () => void;
  paneReorderEnabled: boolean;
  onPaneDragStart?: (paneId: string) => void;
  onPaneDragLeave?: () => void;
  onPaneDrop?: (targetPaneId: string, zone: PaneDropZone) => void;
  paneDropOverlayActive: boolean;
  paneDragSourcePaneId: string | null;
  t: TFunction;
  language: string;
};

export function ConversationPaneHost({
  sessionPath,
  paneId,
  isFocused,
  isAnchorPane,
  isSessionSidebarAnchorPane,
  useIsolatedPane,
  splitPaneCount,
  onFocusPane,
  onSplit,
  onSplitVertical,
  onClosePane,
  showClosePane,
  useMicaBackdrop,
  paneReorderEnabled,
  onPaneDragStart,
  onPaneDragLeave,
  onPaneDrop,
  paneDropOverlayActive,
  paneDragSourcePaneId,
  ...controllerInput
}: ConversationPaneHostProps) {
  const split = useConversationSplit();
  const pane = useConversationPaneController({
    ...controllerInput,
    sessionPath,
    isFocused,
    isAnchorPane,
    useIsolatedPane,
    splitPaneCount,
    layoutNavigationPending: controllerInput.runtime.layoutNavigationPending,
    conversationAbortShortcutTargetRef: split.conversationAbortShortcutTargetRef ?? undefined,
  });

  useEffect(() => {
    if (!isFocused) {
      return;
    }
    split.setFocusedPaneComposerInsert(pane.composerInsertHandlers);
    return () => {
      split.setFocusedPaneComposerInsert(null);
    };
  }, [isFocused, pane.composerInsertHandlers, split]);
  const handleDeleteSession = useCallback(
    async (path: string) => {
      if (splitPaneCount > 1) {
        if (controllerInput.runtime.apiReady) {
          await controllerInput.runtime.deleteSession(path);
        }
        return;
      }
      if (controllerInput.onDeleteSession) {
        await controllerInput.onDeleteSession(path);
      }
    },
    [controllerInput.onDeleteSession, controllerInput.runtime, splitPaneCount],
  );
  const handleDeleteSessionOverlayClosed = useCallback(() => {
    if (splitPaneCount > 1) {
      void split.collapsePaneLayoutById(paneId);
    }
  }, [paneId, split, splitPaneCount]);

  return (
    <ConversationView
      useMicaBackdrop={useMicaBackdrop}
      snapshot={pane.paneSnapshot}
      isEmptySession={pane.paneIsEmptySession}
      hideStaleConversationMessages={pane.hideStaleConversationMessages}
      showComposerDock
      showSessionSidebarToggle={splitPaneCount <= 1 || isSessionSidebarAnchorPane}
      showWorkspaceToggle={isAnchorPane}
      showSplitMenu
      showClosePane={showClosePane}
      onSplit={onSplit}
      onSplitVertical={onSplitVertical}
      onClosePane={onClosePane}
      paneId={paneId}
      onPaneFocus={onFocusPane}
      onPaneDragStart={paneReorderEnabled ? onPaneDragStart : undefined}
      onPaneDragLeave={paneReorderEnabled ? onPaneDragLeave : undefined}
      onPaneDrop={paneReorderEnabled ? onPaneDrop : undefined}
      paneDropOverlayActive={paneDropOverlayActive}
      paneDragSourcePaneId={paneDragSourcePaneId}
      subagentViewActive={pane.subagentViewActive}
      onExitSubagentViewer={pane.onExitSubagentViewer}
      onNewSession={controllerInput.onNewSession}
      newSessionBusy={controllerInput.newSessionBusy}
      showDeleteSession={
        !pane.paneIsEmptySession && Boolean(controllerInput.onDeleteSession)
      }
      deleteSessionPath={sessionPath}
      deleteSessionDisplayName={pane.paneSnapshot?.activeSession?.displayName ?? null}
      deleteSessionBusy={controllerInput.deleteSessionBusy}
      conversationBusy={pane.paneSnapshot?.conversation.isBusy === true}
      onDeleteSession={handleDeleteSession}
      onDeleteSessionOverlayClosed={handleDeleteSessionOverlayClosed}
      compactionDemoActive={pane.compactionDemoActive}
      onCompactionDemoStop={controllerInput.onCompactionDemoStop}
      rewindDraft={pane.rewindDraft}
      onRewindDraftClear={pane.onRewindDraftClear}
      conversationScrollBedPaddingPx={pane.conversationScrollBedPaddingPx}
      list={pane.list}
      composerDock={pane.composerDock}
    />
  );
}

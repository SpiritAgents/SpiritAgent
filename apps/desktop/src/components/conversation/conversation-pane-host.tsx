import { memo } from "react";

import { ConversationView } from "@/components/conversation/conversation-view";
import { useConversationPaneController } from "@/hooks/useConversationPaneController";
import type { useCompactionUiDemo } from "@/hooks/useCompactionUiDemo";
import type { useDesktopRuntime } from "@/hooks/useDesktopRuntime";
import type { useSubagentViewer } from "@/hooks/useSubagentViewer";
import type { useWorkspaceToolsController } from "@/hooks/useWorkspaceToolsController";
import type { PaneDropZone } from "@/lib/conversation-split-layout";
import { paneHostRenderSignature } from "@/lib/pane-desktop-snapshot";
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

function ConversationPaneHostInner({
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
  const pane = useConversationPaneController({
    ...controllerInput,
    sessionPath,
    isFocused,
    isAnchorPane,
    useIsolatedPane,
    splitPaneCount,
    layoutNavigationPending: controllerInput.runtime.layoutNavigationPending,
  });

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

function paneHostPropsEqual(
  prev: ConversationPaneHostProps,
  next: ConversationPaneHostProps,
): boolean {
  if (prev.isFocused !== next.isFocused) {
    return false;
  }
  if (prev.isAnchorPane !== next.isAnchorPane) {
    return false;
  }
  if (prev.sessionPath !== next.sessionPath) {
    return false;
  }
  if (prev.sessionNavigationBusy !== next.sessionNavigationBusy) {
    return false;
  }
  if (prev.newSessionBusy !== next.newSessionBusy) {
    return false;
  }
  if (prev.hideStaleConversationMessages !== next.hideStaleConversationMessages) {
    return false;
  }
  if (prev.subagentViewActive !== next.subagentViewActive) {
    return false;
  }
  if (
    (prev.compactionDemo.active && prev.isFocused)
    !== (next.compactionDemo.active && next.isFocused)
  ) {
    return false;
  }
  if (prev.showClosePane !== next.showClosePane) {
    return false;
  }
  if (prev.useMicaBackdrop !== next.useMicaBackdrop) {
    return false;
  }
  if (prev.language !== next.language) {
    return false;
  }
  if (prev.useIsolatedPane !== next.useIsolatedPane) {
    return false;
  }
  if (
    (!prev.useIsolatedPane || !next.useIsolatedPane)
    && prev.splitPaneCount !== next.splitPaneCount
  ) {
    return false;
  }
  if (prev.paneReorderEnabled !== next.paneReorderEnabled) {
    return false;
  }
  if (prev.paneDropOverlayActive !== next.paneDropOverlayActive) {
    return false;
  }
  if (prev.paneDragSourcePaneId !== next.paneDragSourcePaneId) {
    return false;
  }
  if (prev.runtime.layoutNavigationPending !== next.runtime.layoutNavigationPending) {
    return false;
  }
  if (prev.runtime.busyAction !== next.runtime.busyAction) {
    return false;
  }
  return (
    paneHostRenderSignature(prev.baseSnapshot, prev.sessionPath)
    === paneHostRenderSignature(next.baseSnapshot, next.sessionPath)
  );
}

export const ConversationPaneHost = memo(ConversationPaneHostInner, paneHostPropsEqual);

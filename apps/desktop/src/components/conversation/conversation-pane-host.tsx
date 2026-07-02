import { useConversationSplit } from "@/contexts/conversation-split-context";
import { ConversationView } from "@/components/conversation/conversation-view";
import { useConversationPaneController } from "@/hooks/useConversationPaneController";
import type { useCompactionUiDemo } from "@/hooks/useCompactionUiDemo";
import type { useDesktopRuntime } from "@/hooks/useDesktopRuntime";
import type { useSubagentViewer } from "@/hooks/useSubagentViewer";
import type { useWorkspaceToolsController } from "@/hooks/useWorkspaceToolsController";
import type { PaneRepositionZone } from "@/lib/conversation-split-layout";
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
  onFocusPane: () => void;
  onSplit: () => void;
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
  t: TFunction;
  language: string;
};

export function ConversationPaneHost({
  sessionPath,
  paneId,
  isFocused,
  isAnchorPane,
  onFocusPane,
  onSplit,
  onClosePane,
  showClosePane,
  useMicaBackdrop,
  ...controllerInput
}: ConversationPaneHostProps) {
  const split = useConversationSplit();
  const pane = useConversationPaneController({
    ...controllerInput,
    sessionPath,
    isFocused,
    isAnchorPane,
    useIsolatedPane: split.paneCount > 1,
    splitPaneCount: split.paneCount,
    layoutNavigationPending: split.layoutNavigationPending,
  });

  const handlePaneDrop = (targetPaneId: string, zone: PaneRepositionZone) => {
    split.completePaneDrop(targetPaneId, zone);
  };

  return (
    <ConversationView
      useMicaBackdrop={useMicaBackdrop}
      snapshot={pane.paneSnapshot}
      isEmptySession={pane.paneIsEmptySession}
      hideStaleConversationMessages={pane.hideStaleConversationMessages}
      showComposerDock
      showWorkspaceToolsDock={isAnchorPane}
      showSessionSidebarToggle={split.paneCount <= 1 || !isAnchorPane}
      showWorkspaceToggle={isAnchorPane}
      showSplitMenu
      showClosePane={showClosePane}
      onSplit={onSplit}
      onClosePane={onClosePane}
      paneId={paneId}
      onPaneFocus={onFocusPane}
      onPaneDragStart={split.startPaneDrag}
      onPaneDragLeave={split.clearPaneDrag}
      onPaneDrop={handlePaneDrop}
      paneDropOverlayActive={split.paneDragActive}
      paneDragSourcePaneId={split.paneDragSourcePaneId}
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
      workspaceTools={pane.workspaceTools}
    />
  );
}

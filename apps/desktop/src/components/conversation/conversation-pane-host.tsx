import { useMemo } from "react";

import { ConversationView, type ConversationViewProps } from "@/components/conversation/conversation-view";
import { useConversationSplit } from "@/contexts/conversation-split-context";
import { resolvePaneDesktopSnapshot, resolvePaneIsEmptySession } from "@/lib/pane-desktop-snapshot";
import type { PaneRepositionZone } from "@/lib/conversation-split-layout";

export type ConversationPaneHostProps = ConversationViewProps & {
  sessionPath: string;
  paneId: string;
  isFocused: boolean;
  isAnchorPane: boolean;
  onFocusPane: () => void;
  onSplit: () => void;
  onClosePane: () => void;
  showClosePane: boolean;
  baseSnapshot: ConversationViewProps["snapshot"];
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
  baseSnapshot,
  isEmptySession,
  hideStaleConversationMessages,
  snapshot,
  ...rest
}: ConversationPaneHostProps) {
  const split = useConversationSplit();

  const paneSnapshot = useMemo(
    () => resolvePaneDesktopSnapshot(baseSnapshot ?? snapshot, sessionPath),
    [baseSnapshot, sessionPath, snapshot],
  );

  const paneIsEmptySession = useMemo(() => {
    if (isFocused) {
      return isEmptySession;
    }
    return resolvePaneIsEmptySession(baseSnapshot ?? snapshot, sessionPath);
  }, [baseSnapshot, isEmptySession, isFocused, sessionPath, snapshot]);

  const handlePaneDrop = (targetPaneId: string, zone: PaneRepositionZone) => {
    split.completePaneDrop(targetPaneId, zone);
  };

  return (
    <ConversationView
      {...rest}
      snapshot={paneSnapshot}
      isEmptySession={paneIsEmptySession}
      hideStaleConversationMessages={isFocused ? hideStaleConversationMessages : false}
      showComposerDock={isFocused}
      showWorkspaceToolsDock={isAnchorPane}
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
    />
  );
}

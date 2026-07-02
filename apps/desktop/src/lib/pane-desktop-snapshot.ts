import type {
  DesktopSnapshot,
  PaneSessionSlice,
} from "@/types";

function normalizeSessionPathKey(sessionPath: string): string {
  return sessionPath.replace(/\\/g, "/").toLowerCase();
}

export function lookupPaneSessionSlice(
  snapshot: DesktopSnapshot | null | undefined,
  sessionPath: string,
): PaneSessionSlice | undefined {
  if (!snapshot?.paneSessions) {
    return undefined;
  }
  const target = normalizeSessionPathKey(sessionPath);
  for (const [key, slice] of Object.entries(snapshot.paneSessions)) {
    if (normalizeSessionPathKey(key) === target) {
      return slice;
    }
  }
  return undefined;
}

export function resolvePaneDesktopSnapshot(
  snapshot: DesktopSnapshot | null,
  sessionPath: string,
): DesktopSnapshot | null {
  if (!snapshot) {
    return null;
  }

  const target = normalizeSessionPathKey(sessionPath);
  const activeKey = snapshot.activeSession?.filePath
    ? normalizeSessionPathKey(snapshot.activeSession.filePath)
    : "";
  if (activeKey && target === activeKey) {
    return snapshot;
  }

  const pane = lookupPaneSessionSlice(snapshot, sessionPath);
  if (!pane) {
    // Stale layout path after promote: do not project the foreground conversation onto this pane.
    if (snapshot.paneSessions && Object.keys(snapshot.paneSessions).length > 0) {
      return {
        ...snapshot,
        conversation: {
          ...snapshot.conversation,
          messages: [],
        },
      };
    }
    return snapshot;
  }
  if (pane.isForegroundActive) {
    return snapshot;
  }

  return {
    ...snapshot,
    conversation: pane.conversation,
    ...(pane.activeSession ? { activeSession: pane.activeSession } : {}),
    composerSessionKey: pane.composerSessionKey,
  };
}

export function resolvePaneIsEmptySession(
  snapshot: DesktopSnapshot | null,
  sessionPath: string,
): boolean {
  const paneSnapshot = resolvePaneDesktopSnapshot(snapshot, sessionPath);
  if (!paneSnapshot) {
    return true;
  }
  return paneSnapshot.conversation.messages.length === 0;
}

/** Stable per-pane render key: skip React re-render when this pane's projected data is unchanged. */
export function paneHostRenderSignature(
  snapshot: DesktopSnapshot | null,
  sessionPath: string,
): string {
  if (!snapshot) {
    return `${sessionPath}:null`;
  }
  const target = normalizeSessionPathKey(sessionPath);
  const activeKey = snapshot.activeSession?.filePath
    ? normalizeSessionPathKey(snapshot.activeSession.filePath)
    : "";
  const isForeground = Boolean(activeKey && target === activeKey);
  if (isForeground) {
    const conv = snapshot.conversation;
    return [
      "fg",
      sessionPath,
      snapshot.composerSessionKey,
      conv.revision ?? 0,
      conv.messages.length,
      conv.isBusy ? 1 : 0,
      snapshot.activeSession?.filePath ?? "",
      snapshot.activeSession?.displayName ?? "",
      snapshot.git.selectedBranch ?? snapshot.git.branch ?? "",
      snapshot.git.workLocation ?? "",
      snapshot.git.isRepository ? 1 : 0,
      Boolean(conv.pendingToolApproval),
      Boolean(conv.pendingQuestions),
    ].join("\0");
  }
  const slice = lookupPaneSessionSlice(snapshot, sessionPath);
  if (!slice) {
    return `${sessionPath}:missing`;
  }
  const conv = slice.conversation;
  return [
    "bg",
    sessionPath,
    slice.composerSessionKey,
    conv.revision ?? 0,
    conv.messages.length,
    conv.isBusy ? 1 : 0,
    slice.activeSession?.filePath ?? "",
    slice.activeSession?.displayName ?? "",
    slice.isForegroundActive ? 1 : 0,
    Boolean(conv.pendingToolApproval),
    Boolean(conv.pendingQuestions),
  ].join("\0");
}

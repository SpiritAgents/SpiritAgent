import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { useDesktopRuntime } from "@/hooks/useDesktopRuntime";
import {
  closePane,
  collectPaneSessionPaths,
  countPanes,
  createLeafNode,
  createPaneId,
  createSinglePaneLayout,
  findLeafByPaneId,
  findWorkspaceToolsAnchorPaneId,
  repositionPane,
  splitPaneAt,
  updateLeafSessionPath,
  updateSplitRatio,
  type PaneRepositionZone,
  type SplitDirection,
  type SplitLayoutNode,
} from "@/lib/conversation-split-layout";
import {
  readConversationSplitLayoutJson,
  writeConversationSplitLayoutJson,
} from "@/lib/layout-prefs";
import type { DesktopSnapshot } from "@/types";

type DesktopRuntime = ReturnType<typeof useDesktopRuntime>;

type ConversationSplitContextValue = {
  layout: SplitLayoutNode | null;
  focusedPaneId: string | null;
  anchorPaneId: string | null;
  paneCount: number;
  focusPane: (paneId: string, sessionPath: string) => void;
  splitPane: (paneId: string, direction?: SplitDirection) => Promise<void>;
  closePaneById: (paneId: string, sessionPath: string) => Promise<void>;
  updateRatio: (splitId: string, ratio: number) => void;
  repositionPaneById: (
    sourcePaneId: string,
    targetPaneId: string,
    zone: PaneRepositionZone,
  ) => void;
  startPaneDrag: (paneId: string) => void;
  clearPaneDrag: () => void;
  completePaneDrop: (targetPaneId: string, zone: PaneRepositionZone) => void;
  paneDragActive: boolean;
};

const ConversationSplitContext = createContext<ConversationSplitContextValue | null>(null);

function parseStoredLayout(
  json: string | null,
  fallbackPaneId: string,
  fallbackSessionPath: string,
): SplitLayoutNode {
  if (!json) {
    return createSinglePaneLayout(fallbackPaneId, fallbackSessionPath);
  }
  try {
    const parsed = JSON.parse(json) as SplitLayoutNode;
    if (parsed?.kind === "leaf" && parsed.paneId && parsed.sessionPath) {
      return parsed;
    }
    if (parsed?.kind === "split" && parsed.first && parsed.second) {
      return parsed;
    }
  } catch {
    // ignore invalid persisted layout
  }
  return createSinglePaneLayout(fallbackPaneId, fallbackSessionPath);
}

export function ConversationSplitProvider({
  runtime,
  snapshot,
  children,
}: {
  runtime: DesktopRuntime;
  snapshot: DesktopSnapshot | null;
  children: ReactNode;
}) {
  const rootPaneIdRef = useRef(createPaneId());
  const activeSessionPath = snapshot?.activeSession?.filePath ?? "";
  const [layout, setLayout] = useState<SplitLayoutNode | null>(null);
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(null);
  const [paneDragActive, setPaneDragActive] = useState(false);
  const visiblePathsSyncedRef = useRef<string>("");
  const dragSourcePaneIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeSessionPath) {
      return;
    }
    setLayout((current) => {
      const next = current
        ? updateLeafSessionPath(
            current,
            findWorkspaceToolsAnchorPaneId(current),
            activeSessionPath,
          )
        : parseStoredLayout(
            readConversationSplitLayoutJson(),
            rootPaneIdRef.current,
            activeSessionPath,
          );
      return next;
    });
  }, [activeSessionPath]);

  useEffect(() => {
    if (!layout) {
      return;
    }
    setFocusedPaneId((current) => {
      if (current && findLeafByPaneId(layout, current)) {
        return current;
      }
      const anchorPaneId = findWorkspaceToolsAnchorPaneId(layout);
      return anchorPaneId;
    });
  }, [layout]);

  useEffect(() => {
    if (!layout || !runtime.apiReady) {
      return;
    }
    const paths = collectPaneSessionPaths(layout);
    const signature = paths.join("\0");
    if (signature === visiblePathsSyncedRef.current) {
      return;
    }
    visiblePathsSyncedRef.current = signature;
    void runtime.setVisiblePaneSessions(paths);
  }, [layout, runtime, runtime.apiReady]);

  useEffect(() => {
    if (!layout) {
      return;
    }
    writeConversationSplitLayoutJson(JSON.stringify(layout));
  }, [layout]);

  const syncVisiblePaths = useCallback(
    async (nextLayout: SplitLayoutNode | null) => {
      if (!nextLayout || !runtime.apiReady) {
        return;
      }
      const paths = collectPaneSessionPaths(nextLayout);
      visiblePathsSyncedRef.current = paths.join("\0");
      await runtime.setVisiblePaneSessions(paths);
    },
    [runtime],
  );

  const focusPane = useCallback(
    (paneId: string, sessionPath: string) => {
      setFocusedPaneId(paneId);
      if (snapshot?.activeSession?.filePath !== sessionPath) {
        void runtime.openSession(sessionPath);
      }
    },
    [runtime, snapshot?.activeSession?.filePath],
  );

  const splitPane = useCallback(
    async (paneId: string, direction: SplitDirection = "horizontal") => {
      if (!layout || !runtime.apiReady) {
        return;
      }
      const newPaneId = createPaneId();
      const response = await runtime.beginSplitPaneSession(newPaneId);
      const newLeaf = createLeafNode(newPaneId, response.sessionPath);
      const nextLayout = splitPaneAt(layout, paneId, direction, newLeaf);
      setLayout(nextLayout);
      await syncVisiblePaths(nextLayout);
      focusPane(newPaneId, response.sessionPath);
    },
    [focusPane, layout, runtime, syncVisiblePaths],
  );

  const closePaneById = useCallback(
    async (paneId: string, sessionPath: string) => {
      if (!layout) {
        return;
      }
      const nextLayout = closePane(layout, paneId);
      if (!nextLayout) {
        return;
      }
      setLayout(nextLayout);
      if (runtime.apiReady) {
        await runtime.closeSplitPaneSession(sessionPath);
      }
      await syncVisiblePaths(nextLayout);
      if (focusedPaneId === paneId) {
        const anchorPaneId = findWorkspaceToolsAnchorPaneId(nextLayout);
        const anchorLeaf = findLeafByPaneId(nextLayout, anchorPaneId);
        if (anchorLeaf) {
          focusPane(anchorLeaf.paneId, anchorLeaf.sessionPath);
        }
      }
    },
    [focusPane, focusedPaneId, layout, runtime, syncVisiblePaths],
  );

  const updateRatio = useCallback((splitId: string, ratio: number) => {
    setLayout((current) => (current ? updateSplitRatio(current, splitId, ratio) : current));
  }, []);

  const repositionPaneById = useCallback(
    (sourcePaneId: string, targetPaneId: string, zone: PaneRepositionZone) => {
      setLayout((current) => {
        if (!current) {
          return current;
        }
        return repositionPane(current, sourcePaneId, targetPaneId, zone) ?? current;
      });
    },
    [],
  );

  const startPaneDrag = useCallback((paneId: string) => {
    dragSourcePaneIdRef.current = paneId;
    setPaneDragActive(true);
  }, []);

  const clearPaneDrag = useCallback(() => {
    dragSourcePaneIdRef.current = null;
    setPaneDragActive(false);
  }, []);

  const completePaneDrop = useCallback(
    (targetPaneId: string, zone: PaneRepositionZone) => {
      const sourcePaneId = dragSourcePaneIdRef.current;
      dragSourcePaneIdRef.current = null;
      setPaneDragActive(false);
      if (!sourcePaneId) {
        return;
      }
      repositionPaneById(sourcePaneId, targetPaneId, zone);
    },
    [repositionPaneById],
  );

  const value = useMemo<ConversationSplitContextValue>(
    () => ({
      layout,
      focusedPaneId,
      anchorPaneId: layout ? findWorkspaceToolsAnchorPaneId(layout) : null,
      paneCount: layout ? countPanes(layout) : 0,
      focusPane,
      splitPane,
      closePaneById,
      updateRatio,
      repositionPaneById,
      startPaneDrag,
      clearPaneDrag,
      completePaneDrop,
      paneDragActive,
    }),
    [
      clearPaneDrag,
      closePaneById,
      completePaneDrop,
      focusPane,
      focusedPaneId,
      layout,
      paneDragActive,
      repositionPaneById,
      splitPane,
      startPaneDrag,
      updateRatio,
    ],
  );

  return (
    <ConversationSplitContext.Provider value={value}>{children}</ConversationSplitContext.Provider>
  );
}

export function useConversationSplit(): ConversationSplitContextValue {
  const context = useContext(ConversationSplitContext);
  if (!context) {
    throw new Error("useConversationSplit must be used within ConversationSplitProvider");
  }
  return context;
}

export function useOptionalConversationSplit(): ConversationSplitContextValue | null {
  return useContext(ConversationSplitContext);
}

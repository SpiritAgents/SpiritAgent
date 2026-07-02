import {

  createContext,

  useCallback,

  useContext,

  useEffect,

  useLayoutEffect,

  useMemo,

  useRef,

  useState,

  type ReactNode,

} from "react";



import type { useDesktopRuntime } from "@/hooks/useDesktopRuntime";

import {

  closePane,

  collectPaneSessionPaths,

  collectSplitLayoutLeaves,

  countPanes,

  createLeafNode,

  createPaneId,

  createSinglePaneLayout,

  findDuplicateSessionPathLeaves,

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

import { clearConversationSplitLayoutJson } from "@/lib/layout-prefs";

import { lookupPaneSessionSlice } from "@/lib/pane-desktop-snapshot";

import {

  clearSessionSplitBindings,

  persistSessionSplitBinding,

  readSessionSplitBinding,

  remapSessionSplitBindingPath,

  sanitizeSessionSplitBindings,

} from "@/lib/session-split-binding";

import {
  isForegroundProvisionalSessionPath,
  isSplitPaneProvisionalSessionPath,
  isStableChatSessionPath,
  normalizeSessionPathKey,
} from "@/lib/session-path-kind";

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

  paneDragSourcePaneId: string | null;

  paneDropTarget: { paneId: string; zone: PaneRepositionZone } | null;

  setPaneDropTarget: (target: { paneId: string; zone: PaneRepositionZone } | null) => void;

  layoutNavigationPending: boolean;

};



const ConversationSplitContext = createContext<ConversationSplitContextValue | null>(null);



function layoutIncludesSessionPath(layout: SplitLayoutNode, sessionPath: string): boolean {

  const target = normalizeSessionPathKey(sessionPath);

  return collectPaneSessionPaths(layout).some(

    (path) => normalizeSessionPathKey(path) === target,

  );

}



function splitLayoutHasPromotedSuccessor(

  layout: SplitLayoutNode,

  activeSessionPath: string,

  snapshot: DesktopSnapshot | null,

): boolean {

  if (!snapshot?.paneSessions || !lookupPaneSessionSlice(snapshot, activeSessionPath)) {

    return false;

  }

  const activeSlice = lookupPaneSessionSlice(snapshot, activeSessionPath)!;

  if (activeSlice.conversation.messages.length === 0) {

    return false;

  }

  const layoutPathKeys = new Set(

    collectPaneSessionPaths(layout).map(normalizeSessionPathKey),

  );

  if (layoutPathKeys.has(normalizeSessionPathKey(activeSessionPath))) {

    return false;

  }

  return collectSplitLayoutLeaves(layout).some((leaf) => {

    if (!isSplitPaneProvisionalSessionPath(leaf.sessionPath)) {

      return false;

    }

    return !lookupPaneSessionSlice(snapshot, leaf.sessionPath);

  });

}



function normalizeBindingLayoutForSnapshot(

  binding: SplitLayoutNode,

  snapshot: DesktopSnapshot | null,

): SplitLayoutNode {

  if (!snapshot?.paneSessions || countPanes(binding) <= 1) {

    return binding;

  }

  const layoutPathKeys = new Set(

    collectPaneSessionPaths(binding).map(normalizeSessionPathKey),

  );

  let next = binding;

  for (const leaf of collectSplitLayoutLeaves(binding)) {

    if (lookupPaneSessionSlice(snapshot, leaf.sessionPath)) {

      continue;

    }

    if (!isSplitPaneProvisionalSessionPath(leaf.sessionPath)) {

      continue;

    }

    const unmappedPaths = Object.keys(snapshot.paneSessions).filter(

      (sessionPath) => !layoutPathKeys.has(normalizeSessionPathKey(sessionPath)),

    );

    const withMessages = unmappedPaths.filter(

      (sessionPath) =>

        snapshot.paneSessions![sessionPath].conversation.messages.length > 0,

    );

    const candidate =

      withMessages.find((sessionPath) => isStableChatSessionPath(sessionPath)) ??

      withMessages[0];

    if (!candidate) {

      continue;

    }

    next = updateLeafSessionPath(next, leaf.paneId, candidate);

    layoutPathKeys.delete(normalizeSessionPathKey(leaf.sessionPath));

    layoutPathKeys.add(normalizeSessionPathKey(candidate));

  }

  return next;

}



function resolveLayoutForActiveSession(

  activeSessionPath: string,

  current: SplitLayoutNode | null,

  rootPaneId: string,

  snapshot: DesktopSnapshot | null,

): SplitLayoutNode {

  if (current && countPanes(current) > 1) {

    if (isForegroundProvisionalSessionPath(activeSessionPath)) {

      return createSinglePaneLayout(rootPaneId, activeSessionPath);

    }

    if (layoutIncludesSessionPath(current, activeSessionPath)) {

      return current;

    }

  }



  const binding = readSessionSplitBinding(activeSessionPath);

  if (binding && countPanes(binding) > 1) {

    const normalized = normalizeBindingLayoutForSnapshot(binding, snapshot);

    if (

      collectPaneSessionPaths(normalized).join("\0") !==

      collectPaneSessionPaths(binding).join("\0")

    ) {

      persistSessionSplitBinding(normalized);

    }

    return normalized;

  }



  if (!current) {

    return createSinglePaneLayout(rootPaneId, activeSessionPath);

  }



  if (countPanes(current) === 1) {

    const anchorPaneId = findWorkspaceToolsAnchorPaneId(current);

    return updateLeafSessionPath(current, anchorPaneId, activeSessionPath);

  }



  return createSinglePaneLayout(rootPaneId, activeSessionPath);

}



function computeLayoutDecision(

  current: SplitLayoutNode | null,

  activeSessionPath: string,

  snapshot: DesktopSnapshot | null,

): string {

  if (!current) {

    return readSessionSplitBinding(activeSessionPath) ? "restore-binding" : "init-single";

  }

  if (countPanes(current) > 1 && layoutIncludesSessionPath(current, activeSessionPath)) {

    return "keep-split-in-group";

  }

  if (

    countPanes(current) > 1 &&

    splitLayoutHasPromotedSuccessor(current, activeSessionPath, snapshot)

  ) {

    return "keep-split-in-group";

  }

  if (countPanes(current) > 1) {

    if (readSessionSplitBinding(activeSessionPath)) {

      return "restore-binding";

    }

    return "collapse-external-nav";

  }

  if (readSessionSplitBinding(activeSessionPath)) {

    return "restore-binding";

  }

  if (countPanes(current) === 1) {

    return "sync-single-pane";

  }

  return "collapse-single";

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
  const [paneDragSourcePaneId, setPaneDragSourcePaneId] = useState<string | null>(null);
  const [paneDropTarget, setPaneDropTargetState] = useState<{
    paneId: string;
    zone: PaneRepositionZone;
  } | null>(null);

  const setPaneDropTarget = useCallback(
    (target: { paneId: string; zone: PaneRepositionZone } | null) => {
      setPaneDropTargetState((current) => {
        if (
          current?.paneId === target?.paneId
          && current?.zone === target?.zone
        ) {
          return current;
        }
        return target;
      });
    },
    [],
  );

  // 指针不在有效 drop zone 上时同步清除 target（dragLeave 在快速滑过源面板时可能误判）
  useEffect(() => {
    if (!paneDragActive) {
      return;
    }
    const sourcePaneId = paneDragSourcePaneId;
    const handleDocumentDragOver = (event: DragEvent) => {
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      if (!(hit instanceof Element)) {
        setPaneDropTarget(null);
        return;
      }
      const zoneEl = hit.closest("[data-pane-drop-zone]");
      if (zoneEl instanceof HTMLElement) {
        const hostEl = zoneEl.closest("[data-pane-drop-host]");
        const hostPaneId = hostEl?.getAttribute("data-pane-drop-host");
        if (hostPaneId && hostPaneId !== sourcePaneId) {
          return;
        }
      }
      setPaneDropTarget(null);
    };
    document.addEventListener("dragover", handleDocumentDragOver);
    return () => document.removeEventListener("dragover", handleDocumentDragOver);
  }, [paneDragActive, paneDragSourcePaneId, setPaneDropTarget]);

  const [layoutNavigationPending, setLayoutNavigationPending] = useState(false);

  const visiblePathsSyncedRef = useRef<string>("");

  const layoutRef = useRef<SplitLayoutNode | null>(null);

  layoutRef.current = layout;

  const layoutResolveGenerationRef = useRef(0);

  const layoutNavigationLockRef = useRef(false);

  const runtimeRef = useRef(runtime);

  runtimeRef.current = runtime;

  const dragSourcePaneIdRef = useRef<string | null>(null);

  const duplicatePathsReconcilingRef = useRef(false);

  const legacyLayoutClearedRef = useRef(false);



  useEffect(() => {

    if (legacyLayoutClearedRef.current) {

      return;

    }

    legacyLayoutClearedRef.current = true;

    clearConversationSplitLayoutJson();

    sanitizeSessionSplitBindings();

  }, []);



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



  useLayoutEffect(() => {

    if (!activeSessionPath) {

      return;

    }

    const generation = ++layoutResolveGenerationRef.current;

    const current = layoutRef.current;

    const next = resolveLayoutForActiveSession(

      activeSessionPath,

      current,

      rootPaneIdRef.current,

      snapshot,

    );

    const decision = computeLayoutDecision(current, activeSessionPath, snapshot);

    const nextPaths = collectPaneSessionPaths(next);

    const nextPaneCount = countPanes(next);

    const currentPaneCount = current ? countPanes(current) : 0;


    if (decision !== "restore-binding") {
      runtimeRef.current.releaseSessionNavigationBusy();
    }

    if (decision === "keep-split-in-group") {

      if (current !== next) {

        setLayout(next);

      }

      return;

    }

    if (

      (decision === "collapse-external-nav" && nextPaneCount === 1) ||

      (currentPaneCount > 1 && nextPaneCount === 1)

    ) {

      layoutNavigationLockRef.current = true;

      setLayoutNavigationPending(true);

      visiblePathsSyncedRef.current = nextPaths.join("\0");

      setLayout(next);


      void (async () => {

        try {

          await syncVisiblePaths(next);

        } finally {

          if (generation === layoutResolveGenerationRef.current) {

            layoutNavigationLockRef.current = false;

            setLayoutNavigationPending(false);

          }

        }

      })();

      return;

    }

    if (decision === "restore-binding") {

      layoutNavigationLockRef.current = true;

      setLayoutNavigationPending(true);

      const pathsToSync = collectPaneSessionPaths(next);

      visiblePathsSyncedRef.current = pathsToSync.join("\0");


      void (async () => {

        try {

          if (runtimeRef.current.apiReady) {

            await runtimeRef.current.setVisiblePaneSessions(pathsToSync);

          }

          if (generation !== layoutResolveGenerationRef.current) {


            return;

          }

          setLayout(next);


        } finally {

          if (generation === layoutResolveGenerationRef.current) {

            layoutNavigationLockRef.current = false;

            setLayoutNavigationPending(false);

            runtimeRef.current.releaseSessionNavigationBusy();

          }

        }

      })();

      return;

    }


    setLayout(next);

  }, [activeSessionPath]);




  useEffect(() => {
    runtime.setLayoutNavigationPending(layoutNavigationPending);
  }, [layoutNavigationPending, runtime]);



  useEffect(() => {

    if (!layout || !activeSessionPath) {

      return;

    }

    const leaf = collectSplitLayoutLeaves(layout).find(

      (entry) =>

        normalizeSessionPathKey(entry.sessionPath) === normalizeSessionPathKey(activeSessionPath),

    );

    if (leaf) {

      setFocusedPaneId(leaf.paneId);

    }

  }, [activeSessionPath, layout]);



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

    if (!layout || !runtime.apiReady || layoutNavigationLockRef.current) {

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

    if (!layout || layoutNavigationLockRef.current || layoutNavigationPending) {

      return;

    }

    if (countPanes(layout) > 1) {

      persistSessionSplitBinding(layout);

      return;

    }

    const paths = collectPaneSessionPaths(layout);


    clearSessionSplitBindings(paths);

  }, [layout, layoutNavigationPending]);



  useEffect(() => {

    if (!layout || !runtime.apiReady || duplicatePathsReconcilingRef.current) {

      return;

    }

    const duplicates = findDuplicateSessionPathLeaves(layout);

    if (duplicates.length === 0) {

      return;

    }

    duplicatePathsReconcilingRef.current = true;

    void (async () => {

      try {

        let nextLayout = layout;

        for (const leaf of duplicates) {

          const response = await runtime.beginSplitPaneSession(leaf.paneId);

          nextLayout = updateLeafSessionPath(nextLayout, leaf.paneId, response.sessionPath);

        }

        setLayout(nextLayout);

        await syncVisiblePaths(nextLayout);

      } finally {

        duplicatePathsReconcilingRef.current = false;

      }

    })();

  }, [layout, runtime, runtime.apiReady, syncVisiblePaths]);



  useEffect(() => {

    if (!layout || !snapshot?.paneSessions || countPanes(layout) <= 1) {

      return;

    }

    const layoutPathKeys = new Set(

      collectPaneSessionPaths(layout).map(normalizeSessionPathKey),

    );

    const orphans = collectSplitLayoutLeaves(layout).filter(

      (leaf) => !lookupPaneSessionSlice(snapshot, leaf.sessionPath),

    );

    if (orphans.length === 0) {

      return;

    }



    let unmappedPaths = Object.keys(snapshot.paneSessions).filter(

      (sessionPath) => !layoutPathKeys.has(normalizeSessionPathKey(sessionPath)),

    );

    if (unmappedPaths.length === 0) {

      return;

    }



    let nextLayout = layout;

    const repoints: Array<{ paneId: string; fromPath: string; toPath: string }> = [];

    for (const leaf of orphans) {

      if (isStableChatSessionPath(leaf.sessionPath)) {

        continue;

      }

      const withMessages = unmappedPaths.filter(

        (sessionPath) =>

          snapshot.paneSessions![sessionPath].conversation.messages.length > 0,

      );

      const provisionalCandidates = unmappedPaths.filter((sessionPath) =>

        isSplitPaneProvisionalSessionPath(sessionPath),

      );

      const candidates =

        withMessages.length > 0

          ? withMessages

          : provisionalCandidates.length > 0

            ? provisionalCandidates

            : [];

      if (candidates.length === 0) {

        continue;

      }

      const promotedPath = candidates[0]!;

      nextLayout = updateLeafSessionPath(nextLayout, leaf.paneId, promotedPath);

      unmappedPaths = unmappedPaths.filter((path) => path !== promotedPath);

      repoints.push({

        paneId: leaf.paneId,

        fromPath: leaf.sessionPath,

        toPath: promotedPath,

      });

    }

    if (repoints.length === 0) {

      return;

    }

    for (const repoint of repoints) {

      remapSessionSplitBindingPath(repoint.fromPath, repoint.toPath);

    }

    setLayout(nextLayout);

    persistSessionSplitBinding(nextLayout);

    void syncVisiblePaths(nextLayout);

  }, [focusedPaneId, layout, snapshot, syncVisiblePaths]);



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

      persistSessionSplitBinding(nextLayout);


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

      const pathsBeforeClose = collectPaneSessionPaths(layout);

      const nextLayout = closePane(layout, paneId);

      if (!nextLayout) {

        return;

      }

      clearSessionSplitBindings(pathsBeforeClose);

      setLayout(nextLayout);

      if (runtime.apiReady) {

        await runtime.closeSplitPaneSession(sessionPath);

      }

      await syncVisiblePaths(nextLayout);

      if (countPanes(nextLayout) > 1) {

        persistSessionSplitBinding(nextLayout);

      }

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

    setLayout((current) => {

      if (!current) {

        return current;

      }

      const next = updateSplitRatio(current, splitId, ratio);

      if (countPanes(next) > 1) {

        persistSessionSplitBinding(next);

      }

      return next;

    });

  }, []);



  const repositionPaneById = useCallback(

    (sourcePaneId: string, targetPaneId: string, zone: PaneRepositionZone) => {

      setLayout((current) => {

        if (!current) {

          return current;

        }

        const next = repositionPane(current, sourcePaneId, targetPaneId, zone) ?? current;

        if (countPanes(next) > 1) {

          persistSessionSplitBinding(next);

        }

        return next;

      });

    },

    [],

  );



  const startPaneDrag = useCallback((paneId: string) => {

    dragSourcePaneIdRef.current = paneId;

    setPaneDragSourcePaneId(paneId);

    setPaneDragActive(true);

  }, []);



  const clearPaneDrag = useCallback(() => {

    dragSourcePaneIdRef.current = null;

    setPaneDragSourcePaneId(null);

    setPaneDropTarget(null);

    setPaneDragActive(false);

  }, []);



  const completePaneDrop = useCallback(

    (targetPaneId: string, zone: PaneRepositionZone) => {

      const sourcePaneId = dragSourcePaneIdRef.current;

      dragSourcePaneIdRef.current = null;

      setPaneDragSourcePaneId(null);

      setPaneDropTarget(null);

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

      paneDragSourcePaneId,

      paneDropTarget,

      setPaneDropTarget,

      layoutNavigationPending,

    }),

    [

      clearPaneDrag,

      closePaneById,

      completePaneDrop,

      focusPane,

      focusedPaneId,

      layout,

      layoutNavigationPending,

      paneDragActive,

      paneDragSourcePaneId,

      paneDropTarget,

      repositionPaneById,

      setPaneDropTarget,

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



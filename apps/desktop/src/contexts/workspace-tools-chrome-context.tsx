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

import {
  readWorkspaceToolsWidthPx,
  workspaceToolsShellWidthExpression,
  workspaceToolsShellWidthWhenOpen,
} from "@/lib/layout-prefs";

/** 与 SessionSidebarShell / 历史右侧栏开合动画一致 */
const WORKSPACE_TOOLS_SHELL_WIDTH_TRANSITION = "width 300ms cubic-bezier(0.22, 1, 0.36, 1)";
const WORKSPACE_TOOLS_SHELL_WIDTH_TRANSITION_MS = 300;

type WorkspaceToolsChromeActions = {
  setOpen: (updater: boolean | ((current: boolean) => boolean)) => void;
  toggle(): void;
  openTools(): void;
};

const WorkspaceToolsChromeOpenContext = createContext(false);
const WorkspaceToolsChromeActionsContext = createContext<WorkspaceToolsChromeActions | null>(null);

export type WorkspaceToolsChromeApi = {
  open: boolean;
  toggle(): void;
  setOpen: (updater: boolean | ((current: boolean) => boolean)) => void;
};

export type WorkspaceToolsChromeProviderProps = {
  children: ReactNode;
  apiRef?: React.MutableRefObject<WorkspaceToolsChromeApi | null>;
};

let workspaceToolsShellWidthTransitionClearTimer = 0;

function applyWorkspaceToolsShellWidthImmediate(nextOpen: boolean): void {
  const shell = document.getElementById("workspace-tools-panel-shell");
  const aside = document.getElementById("workspace-tools-panel");
  if (!shell || !aside) {
    return;
  }
  const widthRaw = aside.style.width;
  const widthPx =
    widthRaw && widthRaw.endsWith("px")
      ? Number.parseInt(widthRaw, 10)
      : readWorkspaceToolsWidthPx();
  const splitWidth = workspaceToolsShellWidthExpression(widthPx);

  if (workspaceToolsShellWidthTransitionClearTimer !== 0) {
    window.clearTimeout(workspaceToolsShellWidthTransitionClearTimer);
    workspaceToolsShellWidthTransitionClearTimer = 0;
  }

  // 仅开合走 width 过渡；视口缩放改占比时 React 侧保持无 transition，避免拖窗口慢半拍。
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  shell.style.transition = reduceMotion ? "none" : WORKSPACE_TOOLS_SHELL_WIDTH_TRANSITION;
  shell.style.width = workspaceToolsShellWidthWhenOpen(nextOpen, widthPx);
  const split = shell.querySelector("[data-workspace-tools-split]");
  if (split instanceof HTMLElement) {
    split.style.width = splitWidth;
  }

  workspaceToolsShellWidthTransitionClearTimer = window.setTimeout(() => {
    workspaceToolsShellWidthTransitionClearTimer = 0;
    if (shell.isConnected) {
      shell.style.removeProperty("transition");
    }
  }, WORKSPACE_TOOLS_SHELL_WIDTH_TRANSITION_MS + 20);
}

export function WorkspaceToolsChromeProvider({
  children,
  apiRef,
}: WorkspaceToolsChromeProviderProps) {
  const [open, setOpenState] = useState(false);
  const openRef = useRef(open);
  openRef.current = open;

  const setOpen = useCallback((updater: boolean | ((current: boolean) => boolean)) => {
    setOpenState((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      if (next !== current) {
        applyWorkspaceToolsShellWidthImmediate(next);
      }
      return next;
    });
  }, []);

  const toggle = useCallback(() => {
    const next = !openRef.current;
    applyWorkspaceToolsShellWidthImmediate(next);
    setOpenState(next);
  }, []);

  const openTools = useCallback(() => {
    applyWorkspaceToolsShellWidthImmediate(true);
    setOpenState(true);
  }, []);

  const actions = useMemo(
    () => ({
      setOpen,
      toggle,
      openTools,
    }),
    [openTools, setOpen, toggle],
  );

  useEffect(() => {
    if (apiRef) {
      apiRef.current = { open, toggle, setOpen };
    }
  }, [apiRef, open, setOpen, toggle]);

  return (
    <WorkspaceToolsChromeActionsContext.Provider value={actions}>
      <WorkspaceToolsChromeOpenContext.Provider value={open}>
        {children}
      </WorkspaceToolsChromeOpenContext.Provider>
    </WorkspaceToolsChromeActionsContext.Provider>
  );
}

export function useWorkspaceToolsChromeOpen(): boolean {
  return useContext(WorkspaceToolsChromeOpenContext);
}

export function useWorkspaceToolsChromeActions(): WorkspaceToolsChromeActions {
  const value = useContext(WorkspaceToolsChromeActionsContext);
  if (!value) {
    throw new Error(
      "useWorkspaceToolsChromeActions must be used within WorkspaceToolsChromeProvider",
    );
  }
  return value;
}

/** 顶栏按钮：同时需要 open 与 toggle。 */
export function useWorkspaceToolsChrome(): {
  open: boolean;
  setOpen: WorkspaceToolsChromeActions["setOpen"];
  toggle: WorkspaceToolsChromeActions["toggle"];
  openTools: WorkspaceToolsChromeActions["openTools"];
} {
  const open = useWorkspaceToolsChromeOpen();
  const { setOpen, toggle, openTools } = useWorkspaceToolsChromeActions();
  return { open, setOpen, toggle, openTools };
}

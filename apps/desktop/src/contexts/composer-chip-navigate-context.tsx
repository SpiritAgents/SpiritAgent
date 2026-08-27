import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import { ChipLabel } from "@/components/composer-lexical/chips/chip-shell";
import { useConversationSplit } from "@/contexts/conversation-split-context";
import { useGitHubAuthConnected } from "@/hooks/use-github-auth-connected";
import type { useDesktopRuntime } from "@/hooks/useDesktopRuntime";
import type { useWorkspaceToolsController } from "@/hooks/useWorkspaceToolsController";
import {
  resolveComposerChipNavigate,
  type ComposerChipNavigateTarget,
} from "@/lib/composer-chip-navigation";
import { findLeafBySessionPath } from "@/lib/conversation-split-layout";
import { isMarkdownPath } from "@/lib/file-picker-path";
import type { DesktopSnapshot } from "@/types";

type DesktopRuntime = ReturnType<typeof useDesktopRuntime>;
type WorkspaceTools = ReturnType<typeof useWorkspaceToolsController>;

type ComposerChipNavigateContextValue = {
  isNavigable: (target: ComposerChipNavigateTarget) => boolean;
  navigate: (target: ComposerChipNavigateTarget) => void;
};

const ComposerChipNavigateContext = createContext<ComposerChipNavigateContextValue>({
  isNavigable: () => false,
  navigate: () => {},
});

export function useComposerChipNavigate(): ComposerChipNavigateContextValue {
  return useContext(ComposerChipNavigateContext);
}

export function NavigableChipLabel({
  target,
  children,
}: {
  target: ComposerChipNavigateTarget;
  children: ReactNode;
}) {
  const { isNavigable, navigate } = useComposerChipNavigate();
  const navigable = isNavigable(target);
  return (
    <ChipLabel navigable={navigable} onNavigate={navigable ? () => navigate(target) : undefined}>
      {children}
    </ChipLabel>
  );
}

export function ComposerChipNavigateProvider({
  runtime,
  snapshot,
  workspaceTools,
  children,
}: {
  runtime: DesktopRuntime;
  snapshot: DesktopSnapshot | null;
  workspaceTools: WorkspaceTools;
  children: ReactNode;
}) {
  const split = useConversationSplit();
  const githubConnected =
    useGitHubAuthConnected(runtime.getGitHubAuthStatus, workspaceTools.prTabEnabled) === true;

  const env = useMemo(
    () => ({
      tabs: workspaceTools.workspaceToolTabs,
      supportsBrowserTabs: workspaceTools.browserTabEnabled,
      supportsPrTabs: workspaceTools.prTabEnabled,
      githubConnected,
      sessions: runtime.sessions.map((session) => ({
        path: session.path,
        transcriptPath: session.transcriptPath,
      })),
      skills: (snapshot?.skillsList ?? []).map((skill) => ({
        name: skill.name,
        path: skill.path,
      })),
      workspaceRoot: snapshot?.workspaceRoot ?? "",
    }),
    [
      githubConnected,
      runtime.sessions,
      snapshot?.skillsList,
      snapshot?.workspaceRoot,
      workspaceTools.browserTabEnabled,
      workspaceTools.prTabEnabled,
      workspaceTools.workspaceToolTabs,
    ],
  );

  const isNavigable = useCallback(
    (target: ComposerChipNavigateTarget) => {
      // Quote scrolling lands in Phase 3 (virtualizer + side-chat split).
      if (target.kind === "messageQuote") {
        return false;
      }
      return resolveComposerChipNavigate(target, env).navigable;
    },
    [env],
  );

  const navigate = useCallback(
    (target: ComposerChipNavigateTarget) => {
      if (target.kind === "messageQuote") {
        return;
      }
      const decision = resolveComposerChipNavigate(target, env);
      if (!decision.navigable) {
        return;
      }
      const action = decision.action;
      switch (action.type) {
        case "focus-tab":
          workspaceTools.focusWorkspaceToolTab(action.tabId);
          return;
        case "reveal-workspace-path": {
          if (action.directory) {
            if (action.tabId) {
              workspaceTools.revealWorkspaceDirectoryOnTab(action.tabId, action.relativePath);
            } else {
              workspaceTools.revealWorkspaceDirectory(action.relativePath);
            }
            return;
          }
          const reveal = action.line ? { line: action.line } : undefined;
          const viewMode = isMarkdownPath(action.relativePath) && !reveal ? "preview" : "edit";
          if (action.tabId) {
            workspaceTools.openWorkspaceFileOnTab(action.tabId, action.relativePath, {
              viewMode,
              reveal,
            });
            return;
          }
          workspaceTools.openWorkspaceFile(action.relativePath, { viewMode, reveal });
          return;
        }
        case "open-external-file":
          workspaceTools.openEditorFile({
            scope: "external",
            absolutePath: action.absolutePath,
            viewMode: isMarkdownPath(action.absolutePath) ? "preview" : "edit",
          });
          return;
        case "open-browser":
          workspaceTools.focusOrOpenBrowserUrl(action.url, action.preferTabId);
          return;
        case "open-git":
          workspaceTools.openGitTab(action.preferTabId);
          return;
        case "open-pr":
          workspaceTools.openPullRequestInPrTab(
            { owner: action.owner, repo: action.repo, number: action.number },
            action.preferTabId,
          );
          return;
        case "open-session": {
          const leaf = split.layout
            ? findLeafBySessionPath(split.layout, action.chatPath)
            : undefined;
          if (leaf) {
            split.focusPane(leaf.paneId, leaf.sessionPath);
            return;
          }
          void runtime.openSession(action.chatPath);
          return;
        }
        case "scroll-quote":
          return;
        default: {
          const _exhaustive: never = action;
          return _exhaustive;
        }
      }
    },
    [env, runtime, split, workspaceTools],
  );

  const value = useMemo(() => ({ isNavigable, navigate }), [isNavigable, navigate]);

  return (
    <ComposerChipNavigateContext.Provider value={value}>
      {children}
    </ComposerChipNavigateContext.Provider>
  );
}

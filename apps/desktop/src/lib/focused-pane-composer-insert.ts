import { useMemo, type MutableRefObject } from "react";

import type { BrowserElementAttachment } from "@/lib/browser-element-attachment";
import type { FileSnippetAttachment } from "@/lib/file-snippet-attachment";
import type { GitCommitAttachment } from "@/lib/git-commit-attachment";
import type { PrDiffAttachment } from "@/lib/pr-diff-attachment";
import type { TerminalSnippetAttachment } from "@/lib/terminal-snippet-attachment";

export type FocusedPaneComposerInsertHandlers = {
  handleBrowserElementPicked: (attachment: BrowserElementAttachment) => void | Promise<void>;
  handlePrDiffAddToSession: (attachment: PrDiffAttachment) => void;
  handleGitCommitAddToSession: (attachment: GitCommitAttachment) => void;
  handleTerminalAddToSession: (attachment: TerminalSnippetAttachment) => void;
  handleFileSnippetAddToSession: (attachment: FileSnippetAttachment) => void;
  handleWorkspaceFileAddToSession: (relativePath: string) => void;
};

/** Stable proxies: read focused pane handlers from ref at call time (no Provider re-render on register). */
export function useFocusedPaneComposerInsertCallbacks(
  insertRef: MutableRefObject<FocusedPaneComposerInsertHandlers | null>,
  fallback: FocusedPaneComposerInsertHandlers,
): FocusedPaneComposerInsertHandlers {
  return useMemo(
    () => ({
      handleBrowserElementPicked: (attachment) =>
        (insertRef.current?.handleBrowserElementPicked ?? fallback.handleBrowserElementPicked)(
          attachment,
        ),
      handlePrDiffAddToSession: (attachment) =>
        (insertRef.current?.handlePrDiffAddToSession ?? fallback.handlePrDiffAddToSession)(attachment),
      handleGitCommitAddToSession: (attachment) =>
        (insertRef.current?.handleGitCommitAddToSession ?? fallback.handleGitCommitAddToSession)(
          attachment,
        ),
      handleTerminalAddToSession: (attachment) =>
        (insertRef.current?.handleTerminalAddToSession ?? fallback.handleTerminalAddToSession)(
          attachment,
        ),
      handleFileSnippetAddToSession: (attachment) =>
        (insertRef.current?.handleFileSnippetAddToSession ?? fallback.handleFileSnippetAddToSession)(
          attachment,
        ),
      handleWorkspaceFileAddToSession: (relativePath) =>
        (
          insertRef.current?.handleWorkspaceFileAddToSession ??
          fallback.handleWorkspaceFileAddToSession
        )(relativePath),
    }),
    [
      fallback.handleBrowserElementPicked,
      fallback.handleFileSnippetAddToSession,
      fallback.handleGitCommitAddToSession,
      fallback.handlePrDiffAddToSession,
      fallback.handleTerminalAddToSession,
      fallback.handleWorkspaceFileAddToSession,
      insertRef,
    ],
  );
}

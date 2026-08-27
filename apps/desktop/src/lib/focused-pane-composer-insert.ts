import { useMemo } from "react";

import type { BrowserElementAttachment } from "@/lib/browser-element-attachment";
import type { FileSnippetAttachment } from "@/lib/file-snippet-attachment";
import type { GitCommitAttachment } from "@/lib/git-commit-attachment";
import type { MessageQuoteAttachment } from "@/lib/message-quote-attachment";
import type { PrDiffAttachment } from "@/lib/pr-diff-attachment";
import type { TerminalSnippetAttachment } from "@/lib/terminal-snippet-attachment";

export type FocusedPaneComposerInsertHandlers = {
  handleBrowserElementPicked: (attachment: BrowserElementAttachment) => void | Promise<void>;
  handlePrDiffAddToSession: (attachment: PrDiffAttachment) => void;
  handleGitCommitAddToSession: (attachment: GitCommitAttachment) => void;
  handleTerminalAddToSession: (attachment: TerminalSnippetAttachment) => void;
  handleFileSnippetAddToSession: (attachment: FileSnippetAttachment) => void;
  handleWorkspaceFileAddToSession: (relativePath: string, sourceTabId?: string) => void;
  handleMessageQuoteAddToSession: (attachment: MessageQuoteAttachment) => void;
};

/** Stable proxies: read focused pane handlers via getter at call time (no Provider re-render on register). */
export function useFocusedPaneComposerInsertCallbacks(
  getFocusedInsert: () => FocusedPaneComposerInsertHandlers | null,
  fallback: FocusedPaneComposerInsertHandlers,
): FocusedPaneComposerInsertHandlers {
  return useMemo(
    () => ({
      handleBrowserElementPicked: (attachment) =>
        (getFocusedInsert()?.handleBrowserElementPicked ?? fallback.handleBrowserElementPicked)(
          attachment,
        ),
      handlePrDiffAddToSession: (attachment) =>
        (getFocusedInsert()?.handlePrDiffAddToSession ?? fallback.handlePrDiffAddToSession)(
          attachment,
        ),
      handleGitCommitAddToSession: (attachment) =>
        (getFocusedInsert()?.handleGitCommitAddToSession ?? fallback.handleGitCommitAddToSession)(
          attachment,
        ),
      handleTerminalAddToSession: (attachment) =>
        (getFocusedInsert()?.handleTerminalAddToSession ?? fallback.handleTerminalAddToSession)(
          attachment,
        ),
      handleFileSnippetAddToSession: (attachment) =>
        (
          getFocusedInsert()?.handleFileSnippetAddToSession ??
          fallback.handleFileSnippetAddToSession
        )(attachment),
      handleWorkspaceFileAddToSession: (relativePath, sourceTabId) =>
        (
          getFocusedInsert()?.handleWorkspaceFileAddToSession ??
          fallback.handleWorkspaceFileAddToSession
        )(relativePath, sourceTabId),
      handleMessageQuoteAddToSession: (attachment) =>
        (
          getFocusedInsert()?.handleMessageQuoteAddToSession ??
          fallback.handleMessageQuoteAddToSession
        )(attachment),
    }),
    [
      fallback.handleBrowserElementPicked,
      fallback.handleFileSnippetAddToSession,
      fallback.handleGitCommitAddToSession,
      fallback.handleMessageQuoteAddToSession,
      fallback.handlePrDiffAddToSession,
      fallback.handleTerminalAddToSession,
      fallback.handleWorkspaceFileAddToSession,
      getFocusedInsert,
    ],
  );
}

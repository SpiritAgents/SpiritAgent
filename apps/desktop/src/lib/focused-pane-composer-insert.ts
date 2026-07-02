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

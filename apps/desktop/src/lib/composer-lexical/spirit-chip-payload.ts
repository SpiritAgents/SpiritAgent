import { workspaceFilePlainToken, type RichSegment } from "@/lib/composer-segment-model";
import { formatFileSnippetChipLabel } from "@/lib/file-snippet-chip-styles";
import { formatGitCommitChipLabel } from "@/lib/git-commit-chip-styles";
import { formatPrDiffChipLabel } from "@/lib/github-pr-diff-chip-styles";
import { formatTerminalChipLabel } from "@/lib/terminal-chip-styles";

/** Non-text composer segment stored inside a Lexical SpiritChipNode. */
export type SpiritChipPayload = Exclude<RichSegment, { kind: "text" }>;

export function isSpiritChipPayload(value: RichSegment): value is SpiritChipPayload {
  return value.kind !== "text";
}

// 节点层拿不到 ComposerChipLabelsContext（宿主可本地化 label），剪贴板文本统一用默认英文 label
const CHIP_KIND_DEFAULT_LABEL = {
  plan: "Plan",
  ask: "Ask",
  debug: "Debug",
  loop: "Loop",
} as const;

/** Canonical clipboard text for a chip: what Lexical copy / selection text should carry. */
export function spiritChipPlainText(payload: SpiritChipPayload): string {
  switch (payload.kind) {
    case "workspaceFile":
      return workspaceFilePlainToken(payload.path);
    case "skill":
      return payload.alias;
    case "element":
      return `<${payload.attachment.tagName}>`;
    case "prDiff":
      return formatPrDiffChipLabel(
        payload.attachment.filename,
        payload.attachment.lineStart,
        payload.attachment.lineEnd,
      );
    case "gitCommit":
      return formatGitCommitChipLabel(payload.attachment.subject);
    case "terminalSnippet":
      return formatTerminalChipLabel(
        payload.attachment.terminalName,
        payload.attachment.lineStart,
        payload.attachment.lineEnd,
      );
    case "fileSnippet":
      return formatFileSnippetChipLabel(
        payload.attachment.filePath,
        payload.attachment.lineStart,
        payload.attachment.lineEnd,
      );
    case "loop":
    case "plan":
    case "ask":
    case "debug":
      return CHIP_KIND_DEFAULT_LABEL[payload.kind];
    default: {
      const _exhaustive: never = payload;
      return _exhaustive;
    }
  }
}

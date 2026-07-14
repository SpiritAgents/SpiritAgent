import type { GitCommitAttachment } from "./git-commit-attachment.js";
import { formatChipWireBlock, scanChipWireBlocks } from "./chip-wire-block.js";

/** Wire-format git commit block (shared by attachment + composer segment model). */
export function gitCommitContextText(
  attachment: Pick<GitCommitAttachment, "oid" | "subject" | "author" | "authoredAt" | "fullMessage">,
): string {
  return formatChipWireBlock(`git:${attachment.oid}`, attachment.fullMessage);
}

export type ParsedGitCommitWireBlock = {
  index: number;
  length: number;
  oid: string;
  fullMessage: string;
};

/** Scan wire text for git commit blocks; closing fence must be a standalone line. */
export function scanGitCommitWireBlocks(content: string): ParsedGitCommitWireBlock[] {
  return scanChipWireBlocks(content)
    .filter((block) => block.infoLine.startsWith("git:"))
    .map((block) => ({
      index: block.index,
      length: block.length,
      oid: block.infoLine.slice("git:".length).trim(),
      fullMessage: block.body,
    }))
    .filter((block) => block.oid.length > 0);
}

export function deriveGitCommitSubject(fullMessage: string): string {
  return fullMessage.split("\n")[0]?.trim() ?? "";
}

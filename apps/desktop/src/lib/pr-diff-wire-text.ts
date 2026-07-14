import type { PrDiffAttachment } from "./pr-diff-attachment.js";
import { formatChipWireBlock, formatLineRange, scanChipWireBlocks } from "./chip-wire-block.js";

function formatPrDiffWireMeta(attachment: Pick<PrDiffAttachment, "filename" | "lineStart" | "lineEnd" | "status">): string {
  const normalized = attachment.filename.replace(/\\/gu, "/").trim() || "file";
  const hasLines = attachment.lineStart > 0 && attachment.lineEnd > 0;
  const linePart = hasLines ? `L${attachment.lineStart}-${attachment.lineEnd}` : "-";
  return `${normalized}\t${linePart}\t${attachment.status}`;
}

function formatPrDiffInfoLine(
  attachment: Pick<PrDiffAttachment, "prUrl" | "filename" | "lineStart" | "lineEnd" | "status">,
): string {
  const filename = attachment.filename.replace(/\\/gu, "/").trim() || "file";
  const lineSuffix = formatLineRange(attachment.lineStart, attachment.lineEnd).replace(/^:/u, "");
  return `diff:${attachment.prUrl}\t${filename}\t${lineSuffix}\t${attachment.status}`;
}

const PR_DIFF_HEADER_PREFIX = "Selected diff from ";
const PR_DIFF_HEADER_RE = /^Selected diff from ([^\n]+?) \(([^)]*)\):$/u;

/** Wire-format PR diff block (shared by attachment + composer segment model). */
export function prDiffContextText(attachment: Pick<PrDiffAttachment, "prUrl" | "filename" | "lineStart" | "lineEnd" | "status" | "diffText">): string {
  return formatChipWireBlock(formatPrDiffInfoLine(attachment), attachment.diffText);
}

export type ParsedPrDiffWireBlock = {
  index: number;
  length: number;
  prUrl: string;
  meta: string;
  diffText: string;
};

const PR_DIFF_OPEN_FENCE_RE = /^(`{3,})diff\n/;

function scanLegacyPrDiffWireBlocks(content: string): ParsedPrDiffWireBlock[] {
  const blocks: ParsedPrDiffWireBlock[] = [];
  let searchFrom = 0;

  while (searchFrom < content.length) {
    const headerIndex = content.indexOf(PR_DIFF_HEADER_PREFIX, searchFrom);
    if (headerIndex === -1) {
      break;
    }

    const headerLineEnd = content.indexOf("\n", headerIndex);
    if (headerLineEnd === -1) {
      break;
    }

    const headerLine = content.slice(headerIndex, headerLineEnd);
    const headerMatch = PR_DIFF_HEADER_RE.exec(headerLine);
    if (!headerMatch) {
      searchFrom = headerIndex + 1;
      continue;
    }

    let cursor = headerLineEnd + 1;
    const fenceTail = content.slice(cursor);
    const openFenceMatch = PR_DIFF_OPEN_FENCE_RE.exec(fenceTail);
    if (!openFenceMatch) {
      searchFrom = headerIndex + 1;
      continue;
    }
    const fenceMark = openFenceMatch[1] ?? "```";
    const closeFence = fenceMark;
    cursor += openFenceMatch[0].length;

    const diffLines: string[] = [];
    let closed = false;
    while (cursor <= content.length) {
      const nextLineEnd = content.indexOf("\n", cursor);
      const lineEnd = nextLineEnd === -1 ? content.length : nextLineEnd;
      const line = content.slice(cursor, lineEnd);
      if (line === closeFence) {
        const blockEnd = nextLineEnd === -1 ? content.length : nextLineEnd + 1;
        blocks.push({
          index: headerIndex,
          length: blockEnd - headerIndex,
          prUrl: headerMatch[1]?.trim() ?? "",
          meta: headerMatch[2]?.trim() ?? "",
          diffText: diffLines.join("\n"),
        });
        searchFrom = blockEnd;
        closed = true;
        break;
      }
      diffLines.push(line);
      if (nextLineEnd === -1) {
        break;
      }
      cursor = nextLineEnd + 1;
    }

    if (!closed) {
      searchFrom = headerIndex + 1;
    }
  }

  return blocks;
}

function parsePrDiffInfoLine(infoLine: string): {
  prUrl: string;
  filename: string;
  lineStart: number;
  lineEnd: number;
  status: PrDiffAttachment["status"];
} | null {
  if (!infoLine.startsWith("diff:")) {
    return null;
  }
  const parts = infoLine.slice("diff:".length).split("\t");
  if (parts.length !== 4) {
    return null;
  }
  const prUrl = parts[0]?.trim() ?? "";
  const filename = parts[1]?.trim() ?? "";
  const linePart = parts[2]?.trim() ?? "";
  const statusRaw = parts[3]?.trim() ?? "";
  if (
    !prUrl
    || !filename
    || (statusRaw !== "open" && statusRaw !== "merged" && statusRaw !== "closed" && statusRaw !== "draft")
  ) {
    return null;
  }
  if (!linePart) {
    return { prUrl, filename, lineStart: 0, lineEnd: 0, status: statusRaw };
  }
  const singleMatch = /^(\d+)$/u.exec(linePart);
  if (singleMatch) {
    const line = Number(singleMatch[1]);
    return { prUrl, filename, lineStart: line, lineEnd: line, status: statusRaw };
  }
  const rangeMatch = /^(\d+)-(\d+)$/u.exec(linePart);
  if (!rangeMatch) {
    return null;
  }
  return {
    prUrl,
    filename,
    lineStart: Number(rangeMatch[1]),
    lineEnd: Number(rangeMatch[2]),
    status: statusRaw,
  };
}

function scanNewPrDiffWireBlocks(content: string): ParsedPrDiffWireBlock[] {
  return scanChipWireBlocks(content)
    .filter((block) => block.infoLine.startsWith("diff:"))
    .map((block) => {
      const parsed = parsePrDiffInfoLine(block.infoLine);
      if (!parsed) {
        return null;
      }
      const meta = formatPrDiffWireMeta(parsed);
      return {
        index: block.index,
        length: block.length,
        prUrl: parsed.prUrl,
        meta,
        diffText: block.body,
      };
    })
    .filter((block): block is ParsedPrDiffWireBlock => block !== null);
}

/** Scan wire text for PR diff blocks; closing fence must be a standalone line. */
export function scanPrDiffWireBlocks(content: string): ParsedPrDiffWireBlock[] {
  const blocks = [...scanNewPrDiffWireBlocks(content), ...scanLegacyPrDiffWireBlocks(content)];
  blocks.sort((left, right) => left.index - right.index);
  return blocks;
}

/** @deprecated Prefer scanPrDiffWireBlocks for parsing; kept for tests referencing the pattern. */
export const PR_DIFF_BLOCK_RE =
  /Selected diff from ([^\n]+) \(([^)]*)\):\n```diff\n[\s\S]*?\n```/g;

export function parsePrDiffWireMeta(meta: string): {
  filename: string;
  lineStart: number;
  lineEnd: number;
  status: PrDiffAttachment["status"];
} | null {
  const trimmed = meta.trim();
  const tabParts = trimmed.split("\t");
  if (tabParts.length === 3) {
    const filename = tabParts[0]?.trim() ?? "";
    const linePart = tabParts[1]?.trim() ?? "";
    const statusRaw = tabParts[2]?.trim() ?? "";
    if (
      filename
      && (statusRaw === "open" || statusRaw === "merged" || statusRaw === "closed" || statusRaw === "draft")
    ) {
      if (linePart === "-") {
        return { filename, lineStart: 0, lineEnd: 0, status: statusRaw };
      }
      const lineMatch = /^L(\d+)(?:-(\d+))?$/u.exec(linePart);
      if (lineMatch) {
        const lineStart = Number(lineMatch[1]);
        const lineEnd = lineMatch[2] !== undefined ? Number(lineMatch[2]) : lineStart;
        return {
          filename,
          lineStart,
          lineEnd,
          status: statusRaw,
        };
      }
    }
  }

  const statusMatch = /,\s*status:(open|merged|closed|draft)\s*$/u.exec(trimmed);
  if (!statusMatch) {
    return null;
  }
  const status = statusMatch[1] as PrDiffAttachment["status"];
  const beforeStatus = trimmed.slice(0, statusMatch.index);
  const lineMatch = /,\s*L(\d+)-(\d+)\s*$/u.exec(beforeStatus);
  if (lineMatch) {
    const filename = beforeStatus.slice(0, lineMatch.index).trim();
    return {
      filename,
      lineStart: Number(lineMatch[1]),
      lineEnd: Number(lineMatch[2]),
      status,
    };
  }
  return {
    filename: beforeStatus.trim(),
    lineStart: 0,
    lineEnd: 0,
    status,
  };
}

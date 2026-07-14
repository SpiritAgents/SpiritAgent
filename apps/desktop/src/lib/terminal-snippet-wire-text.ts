import type { TerminalSnippetAttachment } from "./terminal-snippet-attachment.js";
import {
  formatChipWireBlock,
  formatLineRange,
  scanChipWireBlocks,
  splitInfoPayloadAndLineRange,
} from "./chip-wire-block.js";

const TERMINAL_SNIPPET_HEADER_PREFIX = "Selected terminal output from ";
/** Match line-range suffix from the end so terminal names may contain ')'. */
const TERMINAL_SNIPPET_HEADER_SUFFIX_RE = / \((L\d+-\d+|-)\):$/u;

function parseTerminalSnippetHeaderLine(
  headerLine: string,
): { terminalName: string; linePart: string } | null {
  if (!headerLine.startsWith(TERMINAL_SNIPPET_HEADER_PREFIX)) {
    return null;
  }
  const suffixMatch = TERMINAL_SNIPPET_HEADER_SUFFIX_RE.exec(headerLine);
  if (!suffixMatch || suffixMatch.index === undefined) {
    return null;
  }
  const terminalName = headerLine
    .slice(TERMINAL_SNIPPET_HEADER_PREFIX.length, suffixMatch.index)
    .trim();
  if (!terminalName) {
    return null;
  }
  return { terminalName, linePart: suffixMatch[1] ?? "-" };
}

/** Wire-format terminal snippet block (shared by attachment + composer segment model). */
export function terminalSnippetContextText(
  attachment: Pick<TerminalSnippetAttachment, "terminalName" | "lineStart" | "lineEnd" | "selectedText">,
): string {
  const name = attachment.terminalName.trim() || "Terminal";
  const lineSuffix = formatLineRange(attachment.lineStart, attachment.lineEnd);
  return formatChipWireBlock(`terminal:${name}${lineSuffix}`, attachment.selectedText);
}

export type ParsedTerminalSnippetWireBlock = {
  index: number;
  length: number;
  terminalName: string;
  meta: string;
  selectedText: string;
};

const TERMINAL_SNIPPET_OPEN_FENCE_RE = /^(`{3,})text\n/;

function scanLegacyTerminalSnippetWireBlocks(content: string): ParsedTerminalSnippetWireBlock[] {
  const blocks: ParsedTerminalSnippetWireBlock[] = [];
  let searchFrom = 0;

  while (searchFrom < content.length) {
    const headerIndex = content.indexOf(TERMINAL_SNIPPET_HEADER_PREFIX, searchFrom);
    if (headerIndex === -1) {
      break;
    }

    const headerLineEnd = content.indexOf("\n", headerIndex);
    if (headerLineEnd === -1) {
      break;
    }

    const headerLine = content.slice(headerIndex, headerLineEnd);
    const parsedHeader = parseTerminalSnippetHeaderLine(headerLine);
    if (!parsedHeader) {
      searchFrom = headerIndex + 1;
      continue;
    }

    let cursor = headerLineEnd + 1;
    const fenceTail = content.slice(cursor);
    const openFenceMatch = TERMINAL_SNIPPET_OPEN_FENCE_RE.exec(fenceTail);
    if (!openFenceMatch) {
      searchFrom = headerIndex + 1;
      continue;
    }
    const fenceMark = openFenceMatch[1] ?? "```";
    const closeFence = fenceMark;
    cursor += openFenceMatch[0].length;

    const bodyLines: string[] = [];
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
          terminalName: parsedHeader.terminalName,
          meta: parsedHeader.linePart,
          selectedText: bodyLines.join("\n"),
        });
        searchFrom = blockEnd;
        closed = true;
        break;
      }
      bodyLines.push(line);
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

function scanNewTerminalSnippetWireBlocks(content: string): ParsedTerminalSnippetWireBlock[] {
  return scanChipWireBlocks(content)
    .filter((block) => block.infoLine.startsWith("terminal:"))
    .map((block) => {
      const split = splitInfoPayloadAndLineRange(block.infoLine.slice("terminal:".length));
      if (!split) {
        return null;
      }
      const meta =
        split.lineStart > 0 && split.lineEnd > 0
          ? split.lineStart === split.lineEnd
            ? `L${split.lineStart}`
            : `L${split.lineStart}-${split.lineEnd}`
          : "-";
      return {
        index: block.index,
        length: block.length,
        terminalName: split.payload,
        meta,
        selectedText: block.body,
      };
    })
    .filter((block): block is ParsedTerminalSnippetWireBlock => block !== null);
}

/** Scan wire text for terminal snippet blocks; closing fence must be a standalone line. */
export function scanTerminalSnippetWireBlocks(content: string): ParsedTerminalSnippetWireBlock[] {
  const blocks = [...scanNewTerminalSnippetWireBlocks(content), ...scanLegacyTerminalSnippetWireBlocks(content)];
  blocks.sort((left, right) => left.index - right.index);
  return blocks;
}

export function parseTerminalSnippetLinePart(linePart: string): {
  lineStart: number;
  lineEnd: number;
} | null {
  const trimmed = linePart.trim();
  if (trimmed === "-") {
    return { lineStart: 0, lineEnd: 0 };
  }
  const lineMatch = /^L(\d+)(?:-(\d+))?$/u.exec(trimmed);
  if (!lineMatch) {
    return null;
  }
  const lineStart = Number(lineMatch[1]);
  const lineEnd = lineMatch[2] !== undefined ? Number(lineMatch[2]) : lineStart;
  return { lineStart, lineEnd };
}

/** @deprecated Prefer parseTerminalSnippetLinePart; kept for legacy tab-separated meta in tests. */
export function parseTerminalSnippetWireMeta(meta: string): {
  terminalName: string;
  lineStart: number;
  lineEnd: number;
} | null {
  const trimmed = meta.trim();
  const tabParts = trimmed.split("\t");
  if (tabParts.length === 2) {
    const terminalName = tabParts[0]?.trim() ?? "";
    const linePart = tabParts[1]?.trim() ?? "";
    if (terminalName) {
      const lines = parseTerminalSnippetLinePart(linePart);
      if (lines) {
        return { terminalName, ...lines };
      }
    }
  }
  return null;
}

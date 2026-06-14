import type { TerminalSnippetAttachment } from "./terminal-snippet-attachment.js";

function formatTerminalSnippetLinePart(
  attachment: Pick<TerminalSnippetAttachment, "lineStart" | "lineEnd">,
): string {
  const hasLines = attachment.lineStart > 0 && attachment.lineEnd > 0;
  return hasLines ? `L${attachment.lineStart}-${attachment.lineEnd}` : "-";
}

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

function chooseTextFence(text: string): { open: string; close: string } {
  if (!/^\s*```/m.test(text)) {
    return { open: "```text\n", close: "\n```" };
  }
  return { open: "````text\n", close: "\n````" };
}

/** Wire-format terminal snippet block (shared by attachment + composer segment model). */
export function terminalSnippetContextText(
  attachment: Pick<TerminalSnippetAttachment, "terminalName" | "lineStart" | "lineEnd" | "selectedText">,
): string {
  const name = attachment.terminalName.trim() || "Terminal";
  const linePart = formatTerminalSnippetLinePart(attachment);
  const fence = chooseTextFence(attachment.selectedText);
  return `Selected terminal output from ${name} (${linePart}):\n${fence.open}${attachment.selectedText}${fence.close}`;
}

export type ParsedTerminalSnippetWireBlock = {
  index: number;
  length: number;
  terminalName: string;
  meta: string;
  selectedText: string;
};

const TERMINAL_SNIPPET_OPEN_FENCE_RE = /^(`{3,})text\n/;

/** Scan wire text for terminal snippet blocks; closing fence must be a standalone line. */
export function scanTerminalSnippetWireBlocks(content: string): ParsedTerminalSnippetWireBlock[] {
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

export function parseTerminalSnippetLinePart(linePart: string): {
  lineStart: number;
  lineEnd: number;
} | null {
  const trimmed = linePart.trim();
  if (trimmed === "-") {
    return { lineStart: 0, lineEnd: 0 };
  }
  const lineMatch = /^L(\d+)-(\d+)$/u.exec(trimmed);
  if (!lineMatch) {
    return null;
  }
  return {
    lineStart: Number(lineMatch[1]),
    lineEnd: Number(lineMatch[2]),
  };
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

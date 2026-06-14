import type { TerminalSnippetAttachment } from "./terminal-snippet-attachment.js";

function formatTerminalSnippetWireMeta(
  attachment: Pick<TerminalSnippetAttachment, "terminalName" | "lineStart" | "lineEnd">,
): string {
  const name = attachment.terminalName.trim() || "Terminal";
  const hasLines = attachment.lineStart > 0 && attachment.lineEnd > 0;
  const linePart = hasLines ? `L${attachment.lineStart}-${attachment.lineEnd}` : "-";
  return `${name}\t${linePart}`;
}

const TERMINAL_SNIPPET_HEADER_PREFIX = "Selected terminal output from ";
const TERMINAL_SNIPPET_HEADER_RE = /^Selected terminal output from ([^\n]+?) \(([^)]*)\):$/u;

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
  const meta = formatTerminalSnippetWireMeta(attachment);
  const fence = chooseTextFence(attachment.selectedText);
  return `Selected terminal output from ${attachment.terminalName.trim() || "Terminal"} (${meta}):\n${fence.open}${attachment.selectedText}${fence.close}`;
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
    const headerMatch = TERMINAL_SNIPPET_HEADER_RE.exec(headerLine);
    if (!headerMatch) {
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
          terminalName: headerMatch[1]?.trim() ?? "",
          meta: headerMatch[2]?.trim() ?? "",
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
      if (linePart === "-") {
        return { terminalName, lineStart: 0, lineEnd: 0 };
      }
      const lineMatch = /^L(\d+)-(\d+)$/u.exec(linePart);
      if (lineMatch) {
        return {
          terminalName,
          lineStart: Number(lineMatch[1]),
          lineEnd: Number(lineMatch[2]),
        };
      }
    }
  }
  return null;
}

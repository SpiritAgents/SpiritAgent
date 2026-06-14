import type { FileSnippetAttachment } from "./file-snippet-attachment.js";

function formatFileSnippetLinePart(
  attachment: Pick<FileSnippetAttachment, "lineStart" | "lineEnd">,
): string {
  const hasLines = attachment.lineStart > 0 && attachment.lineEnd > 0;
  return hasLines ? `L${attachment.lineStart}-${attachment.lineEnd}` : "-";
}

const FILE_SNIPPET_HEADER_PREFIX = "Selected text from ";
/** Match line-range suffix from the end so file paths may contain ')'. */
const FILE_SNIPPET_HEADER_SUFFIX_RE = / \((L\d+-\d+|-)\):$/u;

function parseFileSnippetHeaderLine(
  headerLine: string,
): { filePath: string; linePart: string } | null {
  if (!headerLine.startsWith(FILE_SNIPPET_HEADER_PREFIX)) {
    return null;
  }
  const suffixMatch = FILE_SNIPPET_HEADER_SUFFIX_RE.exec(headerLine);
  if (!suffixMatch || suffixMatch.index === undefined) {
    return null;
  }
  const filePath = headerLine
    .slice(FILE_SNIPPET_HEADER_PREFIX.length, suffixMatch.index)
    .trim();
  if (!filePath) {
    return null;
  }
  return { filePath, linePart: suffixMatch[1] ?? "-" };
}

function chooseTextFence(text: string): { open: string; close: string } {
  if (!/^\s*```/m.test(text)) {
    return { open: "```text\n", close: "\n```" };
  }
  return { open: "````text\n", close: "\n````" };
}

/** Wire-format file snippet block (shared by attachment + composer segment model). */
export function fileSnippetContextText(
  attachment: Pick<FileSnippetAttachment, "filePath" | "lineStart" | "lineEnd" | "selectedText">,
): string {
  const path = attachment.filePath.trim();
  const linePart = formatFileSnippetLinePart(attachment);
  const fence = chooseTextFence(attachment.selectedText);
  return `Selected text from ${path} (${linePart}):\n${fence.open}${attachment.selectedText}${fence.close}`;
}

export type ParsedFileSnippetWireBlock = {
  index: number;
  length: number;
  filePath: string;
  meta: string;
  selectedText: string;
};

const FILE_SNIPPET_OPEN_FENCE_RE = /^(`{3,})text\n/;

/** Scan wire text for file snippet blocks; closing fence must be a standalone line. */
export function scanFileSnippetWireBlocks(content: string): ParsedFileSnippetWireBlock[] {
  const blocks: ParsedFileSnippetWireBlock[] = [];
  let searchFrom = 0;

  while (searchFrom < content.length) {
    const headerIndex = content.indexOf(FILE_SNIPPET_HEADER_PREFIX, searchFrom);
    if (headerIndex === -1) {
      break;
    }

    const headerLineEnd = content.indexOf("\n", headerIndex);
    if (headerLineEnd === -1) {
      break;
    }

    const headerLine = content.slice(headerIndex, headerLineEnd);
    const parsedHeader = parseFileSnippetHeaderLine(headerLine);
    if (!parsedHeader) {
      searchFrom = headerIndex + 1;
      continue;
    }

    let cursor = headerLineEnd + 1;
    const fenceTail = content.slice(cursor);
    const openFenceMatch = FILE_SNIPPET_OPEN_FENCE_RE.exec(fenceTail);
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
          filePath: parsedHeader.filePath,
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

export function parseFileSnippetLinePart(linePart: string): {
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

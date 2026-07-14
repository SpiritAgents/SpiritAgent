import type { FileSnippetAttachment } from "./file-snippet-attachment.js";
import {
  formatChipWireBlock,
  formatLineRange,
  scanChipWireBlocks,
  splitInfoPayloadAndLineRange,
} from "./chip-wire-block.js";

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

/** Wire-format file snippet block (shared by attachment + composer segment model). */
export function fileSnippetContextText(
  attachment: Pick<FileSnippetAttachment, "filePath" | "lineStart" | "lineEnd" | "selectedText">,
): string {
  const path = attachment.filePath.trim();
  const lineSuffix = formatLineRange(attachment.lineStart, attachment.lineEnd);
  return formatChipWireBlock(`file:${path}${lineSuffix}`, attachment.selectedText);
}

export type ParsedFileSnippetWireBlock = {
  index: number;
  length: number;
  filePath: string;
  meta: string;
  selectedText: string;
};

const FILE_SNIPPET_OPEN_FENCE_RE = /^(`{3,})text\n/;

function scanLegacyFileSnippetWireBlocks(content: string): ParsedFileSnippetWireBlock[] {
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

function scanNewFileSnippetWireBlocks(content: string): ParsedFileSnippetWireBlock[] {
  return scanChipWireBlocks(content)
    .filter((block) => block.infoLine.startsWith("file:") && block.body.length > 0)
    .map((block) => {
      const split = splitInfoPayloadAndLineRange(block.infoLine.slice("file:".length));
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
        filePath: split.payload,
        meta,
        selectedText: block.body,
      };
    })
    .filter((block): block is ParsedFileSnippetWireBlock => block !== null);
}

/** Scan wire text for file snippet blocks; closing fence must be a standalone line. */
export function scanFileSnippetWireBlocks(content: string): ParsedFileSnippetWireBlock[] {
  const blocks = [...scanNewFileSnippetWireBlocks(content), ...scanLegacyFileSnippetWireBlocks(content)];
  blocks.sort((left, right) => left.index - right.index);
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
  const lineMatch = /^L(\d+)(?:-(\d+))?$/u.exec(trimmed);
  if (!lineMatch) {
    return null;
  }
  const lineStart = Number(lineMatch[1]);
  const lineEnd = lineMatch[2] !== undefined ? Number(lineMatch[2]) : lineStart;
  return { lineStart, lineEnd };
}

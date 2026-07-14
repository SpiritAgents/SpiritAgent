import { formatChipWireBlock, scanChipWireBlocks } from "./chip-wire-block.js";

export const WORKSPACE_FILE_WIRE_PREFIX = "Referenced workspace file ";

export type ParsedWorkspaceFileWireBlock = {
  index: number;
  length: number;
  path: string;
};

/** Wire-format workspace file chip (inline, explicit composer insertion only). */
export function workspaceFileContextText(path: string): string {
  const normalized = path.replace(/\\/gu, "/");
  return formatChipWireBlock(`file:${normalized}`);
}

function parseWorkspaceFileWireValue(value: string): string | null {
  const parsedPath = value.trim();
  return parsedPath ? parsedPath.replace(/\\/gu, "/") : null;
}

function scanLegacyWorkspaceFileWireBlocks(
  content: string,
): ParsedWorkspaceFileWireBlock[] {
  const blocks: ParsedWorkspaceFileWireBlock[] = [];
  let searchFrom = 0;

  while (searchFrom < content.length) {
    const headerIndex = content.indexOf(WORKSPACE_FILE_WIRE_PREFIX, searchFrom);
    if (headerIndex === -1) {
      break;
    }

    const valueStart = headerIndex + WORKSPACE_FILE_WIRE_PREFIX.length;
    if (content[valueStart] !== "`") {
      searchFrom = headerIndex + 1;
      continue;
    }

    const valueEnd = content.indexOf("`", valueStart + 1);
    if (valueEnd === -1) {
      break;
    }

    const rawValue = content.slice(valueStart + 1, valueEnd);
    const parsed = parseWorkspaceFileWireValue(rawValue);
    if (!parsed) {
      searchFrom = headerIndex + 1;
      continue;
    }

    const length = valueEnd + 1 - headerIndex;
    blocks.push({ index: headerIndex, length, path: parsed });
    searchFrom = headerIndex + length;
  }

  return blocks;
}

function scanNewWorkspaceFileWireBlocks(content: string): ParsedWorkspaceFileWireBlock[] {
  return scanChipWireBlocks(content)
    .filter((block) => block.infoLine.startsWith("file:"))
    .map((block) => ({
      index: block.index,
      length: block.length,
      path: block.infoLine.slice("file:".length).replace(/\\/gu, "/"),
    }))
    .filter((block) => block.path.length > 0);
}

/** Scan wire text for explicit workspace file chip blocks. */
export function scanWorkspaceFileWireBlocks(content: string): ParsedWorkspaceFileWireBlock[] {
  const blocks = [...scanNewWorkspaceFileWireBlocks(content), ...scanLegacyWorkspaceFileWireBlocks(content)];
  blocks.sort((left, right) => left.index - right.index);
  return blocks;
}

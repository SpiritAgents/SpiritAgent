import { formatChipWireBlock, scanChipWireBlocks } from "./chip-wire-block.js";

/** Wire-format element block (shared by attachment + composer segment model). */
export function browserElementContextText(attachment: {
  pageUrl: string;
  outerHtml: string;
}): string {
  return formatChipWireBlock(`element:${attachment.pageUrl}`, attachment.outerHtml);
}

export type ParsedBrowserElementWireBlock = {
  index: number;
  length: number;
  pageUrl: string;
  outerHtml: string;
};

const ELEMENT_BLOCK_RE = /Selected element from ([^\n]*):\n```html\n([\s\S]*?)\n```/g;

function scanLegacyBrowserElementWireBlocks(content: string): ParsedBrowserElementWireBlock[] {
  const blocks: ParsedBrowserElementWireBlock[] = [];
  const elementRe = new RegExp(ELEMENT_BLOCK_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = elementRe.exec(content)) !== null) {
    blocks.push({
      index: match.index,
      length: match[0].length,
      pageUrl: match[1]?.trim() ?? "",
      outerHtml: match[2] ?? "",
    });
  }
  return blocks;
}

function scanNewBrowserElementWireBlocks(content: string): ParsedBrowserElementWireBlock[] {
  return scanChipWireBlocks(content)
    .filter((block) => block.infoLine.startsWith("element:"))
    .map((block) => ({
      index: block.index,
      length: block.length,
      pageUrl: block.infoLine.slice("element:".length),
      outerHtml: block.body,
    }))
    .filter((block) => block.pageUrl.length > 0);
}

/** Scan wire text for browser element blocks. */
export function scanBrowserElementWireBlocks(content: string): ParsedBrowserElementWireBlock[] {
  const blocks = [...scanNewBrowserElementWireBlocks(content), ...scanLegacyBrowserElementWireBlocks(content)];
  blocks.sort((left, right) => left.index - right.index);
  return blocks;
}

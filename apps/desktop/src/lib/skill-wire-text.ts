import { formatChipWireBlock, scanChipWireBlocks } from "./chip-wire-block.js";

export const SKILL_WIRE_PREFIX = "Referenced skill ";

export type ParsedSkillWireBlock = {
  index: number;
  length: number;
  alias: string;
};

/** Wire-format skill chip (inline, explicit composer insertion only). */
export function skillContextText(alias: string): string {
  const normalized = alias.trim();
  return formatChipWireBlock(`skill:${normalized}`);
}

function parseSkillWireValue(value: string): string | null {
  const parsedAlias = value.trim();
  if (!parsedAlias.startsWith("/")) {
    return null;
  }
  return parsedAlias;
}

function scanLegacySkillWireBlocks(content: string): ParsedSkillWireBlock[] {
  const blocks: ParsedSkillWireBlock[] = [];
  let searchFrom = 0;

  while (searchFrom < content.length) {
    const headerIndex = content.indexOf(SKILL_WIRE_PREFIX, searchFrom);
    if (headerIndex === -1) {
      break;
    }

    const valueStart = headerIndex + SKILL_WIRE_PREFIX.length;
    if (content[valueStart] !== "`") {
      searchFrom = headerIndex + 1;
      continue;
    }

    const valueEnd = content.indexOf("`", valueStart + 1);
    if (valueEnd === -1) {
      break;
    }

    const rawValue = content.slice(valueStart + 1, valueEnd);
    const parsed = parseSkillWireValue(rawValue);
    if (!parsed) {
      searchFrom = headerIndex + 1;
      continue;
    }

    const length = valueEnd + 1 - headerIndex;
    blocks.push({ index: headerIndex, length, alias: parsed });
    searchFrom = headerIndex + length;
  }

  return blocks;
}

function scanNewSkillWireBlocks(content: string): ParsedSkillWireBlock[] {
  return scanChipWireBlocks(content)
    .filter((block) => block.infoLine.startsWith("skill:"))
    .map((block) => {
      const alias = block.infoLine.slice("skill:".length).trim();
      return {
        index: block.index,
        length: block.length,
        alias,
      };
    })
    .filter((block) => parseSkillWireValue(block.alias) !== null);
}

/** Scan wire text for explicit skill chip blocks. */
export function scanSkillWireBlocks(content: string): ParsedSkillWireBlock[] {
  const blocks = [...scanNewSkillWireBlocks(content), ...scanLegacySkillWireBlocks(content)];
  blocks.sort((left, right) => left.index - right.index);
  return blocks;
}

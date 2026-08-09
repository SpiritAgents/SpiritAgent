import { readFile } from "node:fs/promises";
import path from "node:path";

import { resolveTranscriptsDir } from "@spiritagent/host-internal";

import {
  scanSessionReferenceWireBlocks,
  sessionReferenceContextText,
} from "../lib/session-reference-wire-text.js";
import { spiritAgentDataDir } from "./storage.js";

const TRANSCRIPT_UNAVAILABLE_BODY =
  "[session transcript unavailable: file missing or unreadable]";

function isPathInsideTranscriptsRoot(candidatePath: string): boolean {
  const transcriptsRoot = path.resolve(resolveTranscriptsDir(spiritAgentDataDir()));
  const resolved = path.resolve(candidatePath);
  const relative = path.relative(transcriptsRoot, resolved);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function readTranscriptBody(transcriptPath: string): Promise<string> {
  if (!isPathInsideTranscriptsRoot(transcriptPath)) {
    return TRANSCRIPT_UNAVAILABLE_BODY;
  }
  try {
    const raw = await readFile(path.resolve(transcriptPath), "utf8");
    const trimmed = raw.trim();
    return trimmed.length > 0 ? raw : TRANSCRIPT_UNAVAILABLE_BODY;
  } catch {
    return TRANSCRIPT_UNAVAILABLE_BODY;
  }
}

/**
 * Expand ```session:...``` fences in user text so the agent receives transcript
 * body in-message (same shape as git/terminal chip wires).
 */
export async function hydrateSessionReferenceWiresInUserText(text: string): Promise<string> {
  const blocks = scanSessionReferenceWireBlocks(text);
  if (blocks.length === 0) {
    return text;
  }

  let result = text;
  for (const block of [...blocks].sort((left, right) => right.index - left.index)) {
    const content =
      block.content.trim().length > 0 ? block.content : await readTranscriptBody(block.path);
    const replacement = sessionReferenceContextText(block.path, block.title, content);
    const blockEnd = block.index + block.length;
    const originalEndsWithNewline = block.length > 0 && result[blockEnd - 1] === "\n";
    const replacementWithTrailing =
      originalEndsWithNewline && !replacement.endsWith("\n") ? `${replacement}\n` : replacement;
    result = result.slice(0, block.index) + replacementWithTrailing + result.slice(blockEnd);
  }
  return result;
}

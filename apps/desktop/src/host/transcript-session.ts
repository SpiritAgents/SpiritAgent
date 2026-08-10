import path from "node:path";

import {
  deleteTranscriptSessionDir,
  ensureTranscriptSessionDir,
  resolveSessionTranscriptFilePath,
} from "@spiritagent/host-internal";

import { spiritAgentDataDir } from "./storage.js";

/** Transcript sessionKey is the resolved chat file path (conversationKey); dir name is hashed in host-internal. */
export function resolveTranscriptSessionKeyForChatPath(chatPath: string): string {
  return path.resolve(chatPath);
}

export function resolveDesktopSessionTranscriptPath(chatPath: string): string {
  return resolveSessionTranscriptFilePath(
    spiritAgentDataDir(),
    resolveTranscriptSessionKeyForChatPath(chatPath),
  );
}

export async function ensureDesktopTranscriptSessionDir(sessionKey: string): Promise<string> {
  return ensureTranscriptSessionDir(spiritAgentDataDir(), sessionKey);
}

export async function ensureDesktopTranscriptSessionDirForChatPath(
  chatPath: string,
): Promise<string> {
  return ensureDesktopTranscriptSessionDir(resolveTranscriptSessionKeyForChatPath(chatPath));
}

export async function deleteDesktopTranscriptSessionDir(sessionKey: string): Promise<void> {
  await deleteTranscriptSessionDir(spiritAgentDataDir(), sessionKey);
}

export async function deleteDesktopTranscriptSessionDirForChatPath(
  chatPath: string,
): Promise<void> {
  await deleteDesktopTranscriptSessionDir(resolveTranscriptSessionKeyForChatPath(chatPath));
}

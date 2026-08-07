import { deleteTranscriptSessionDir, ensureTranscriptSessionDir } from "@spiritagent/host-internal";

import { spiritAgentDataDir } from "./storage.js";

export async function ensureDesktopTranscriptSessionDir(sessionKey: string): Promise<string> {
  return ensureTranscriptSessionDir(spiritAgentDataDir(), sessionKey);
}

export async function deleteDesktopTranscriptSessionDir(sessionKey: string): Promise<void> {
  await deleteTranscriptSessionDir(spiritAgentDataDir(), sessionKey);
}

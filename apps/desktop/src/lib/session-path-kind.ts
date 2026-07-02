export function normalizeSessionPathKey(sessionPath: string): string {
  return sessionPath.replace(/\\/g, "/").toLowerCase();
}

/** Reused draft session path (not a split-pane provisional). */
export function isForegroundProvisionalSessionPath(sessionPath: string): boolean {
  const key = normalizeSessionPathKey(sessionPath);
  return key.includes("/__provisional__/") && !key.includes("/split-");
}

/** Empty session created for a split pane leaf. */
export function isSplitPaneProvisionalSessionPath(sessionPath: string): boolean {
  const key = normalizeSessionPathKey(sessionPath);
  return key.includes("/__provisional__/split-");
}

export function isStableChatSessionPath(sessionPath: string): boolean {
  const key = normalizeSessionPathKey(sessionPath);
  return key.includes("/chats/chat-") && !key.includes("/__provisional__/");
}

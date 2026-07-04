import { useEffect } from "react";

import { isDarwinElectronShell } from "@/lib/desktop-shell";

const DARWIN_CONVERSATION_SPLIT_CLASS = "spirit-desktop-darwin-conversation-split";

/** macOS Split 后顶栏用于 pane 拖拽，禁用窗口级标题栏拖拽以免与 HTML5 drag 冲突。 */
export function useDarwinConversationSplitChrome(paneCount: number): void {
  useEffect(() => {
    if (!isDarwinElectronShell() || typeof document === "undefined") {
      return;
    }
    const splitActive = paneCount > 1;
    document.documentElement.classList.toggle(DARWIN_CONVERSATION_SPLIT_CLASS, splitActive);
    return () => {
      document.documentElement.classList.remove(DARWIN_CONVERSATION_SPLIT_CLASS);
    };
  }, [paneCount]);
}

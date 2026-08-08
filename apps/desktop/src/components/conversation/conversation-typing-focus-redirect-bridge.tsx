import { useEffect } from "react";

import { useConversationSplit } from "@/contexts/conversation-split-context";
import { shouldRedirectKeydownToComposer } from "@/lib/composer-typing-focus-redirect";

export type ConversationTypingFocusRedirectBridgeProps = {
  enabled: boolean;
};

/** Redirects plain typing to the focused pane composer when focus sits outside any editable. */
export function ConversationTypingFocusRedirectBridge({
  enabled,
}: ConversationTypingFocusRedirectBridgeProps) {
  const split = useConversationSplit();

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const controlsRef = split.focusedPaneComposerControlsRef;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!shouldRedirectKeydownToComposer(event)) {
        return;
      }
      // 只同步聚焦、不 preventDefault、不手动注入字符：让原生按键管线把字符送进
      // 刚聚焦的 contenteditable，后续按键才能被 IME 正常接管（首字符因 OS 已完成
      // 分发只能落原始字母，IME 主路径是 conversation-view 的点击预聚焦）。
      controlsRef.current?.focusComposer();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, split.focusedPaneComposerControlsRef]);

  return null;
}

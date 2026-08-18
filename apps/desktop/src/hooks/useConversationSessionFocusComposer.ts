import { useLayoutEffect, useRef } from "react";

export type UseConversationSessionFocusComposerOptions = {
  composerSessionKey: string;
  focusComposer: () => void;
  /** Focus only when the session page is visible and navigation has completed */
  enabled: boolean;
};

/** Move focus to the input after entering the session page or switching the composer session. */
export function useConversationSessionFocusComposer({
  composerSessionKey,
  focusComposer,
  enabled,
}: UseConversationSessionFocusComposerOptions): void {
  const lastFocusedSessionKeyRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!enabled || !composerSessionKey.trim()) {
      return;
    }

    if (lastFocusedSessionKeyRef.current === composerSessionKey) {
      return;
    }

    lastFocusedSessionKeyRef.current = composerSessionKey;

    const focus = () => focusComposer();
    queueMicrotask(focus);
    requestAnimationFrame(focus);
  }, [composerSessionKey, enabled, focusComposer]);
}

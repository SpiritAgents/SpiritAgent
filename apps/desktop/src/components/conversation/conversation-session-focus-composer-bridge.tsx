import { useCallback, useEffect, type MutableRefObject } from "react";

import { useConversationSplit } from "@/contexts/conversation-split-context";
import { useConversationSessionFocusComposer } from "@/hooks/useConversationSessionFocusComposer";

export type ConversationSessionFocusComposerBridgeProps = {
  composerSessionKey: string;
  enabled: boolean;
  composerAutomationApiRef?: MutableRefObject<{
    setSlashSelectedIndex: (index: number) => void;
    focusComposer: () => void;
  } | null>;
  setSlashSelectedIndex: (index: number) => void;
};

/** Routes session-focus to the focused pane composer (App-level composer ref is not mounted). */
export function ConversationSessionFocusComposerBridge({
  composerSessionKey,
  enabled,
  composerAutomationApiRef,
  setSlashSelectedIndex,
}: ConversationSessionFocusComposerBridgeProps) {
  const split = useConversationSplit();
  const focusComposer = useCallback(() => {
    split.focusedPaneComposerFocusRef.current?.();
  }, [split.focusedPaneComposerFocusRef]);

  useEffect(() => {
    if (!composerAutomationApiRef) {
      return;
    }
    composerAutomationApiRef.current = {
      setSlashSelectedIndex,
      focusComposer,
    };
  }, [composerAutomationApiRef, focusComposer, setSlashSelectedIndex]);

  useConversationSessionFocusComposer({
    composerSessionKey,
    focusComposer,
    enabled,
  });

  return null;
}

import { useCallback, useEffect, type MutableRefObject } from "react";

import { useConversationSplit } from "@/contexts/conversation-split-context";
import { useConversationSessionFocusComposer } from "@/hooks/useConversationSessionFocusComposer";
import type { FocusedPaneComposerControls } from "@/lib/focused-pane-composer-controls";

export type ConversationSessionFocusComposerBridgeProps = {
  composerSessionKey: string;
  enabled: boolean;
  composerAutomationApiRef?: MutableRefObject<FocusedPaneComposerControls | null>;
};

/** Routes session-focus and automation seeding to the focused pane composer. */
export function ConversationSessionFocusComposerBridge({
  composerSessionKey,
  enabled,
  composerAutomationApiRef,
}: ConversationSessionFocusComposerBridgeProps) {
  const split = useConversationSplit();
  const focusComposer = useCallback(() => {
    split.focusedPaneComposerControlsRef.current?.focusComposer();
  }, [split.focusedPaneComposerControlsRef]);

  useEffect(() => {
    if (!composerAutomationApiRef) {
      return;
    }
    const controlsRef = split.focusedPaneComposerControlsRef;
    composerAutomationApiRef.current = {
      focusComposer: () => controlsRef.current?.focusComposer(),
      setComposerText: (text) => controlsRef.current?.setComposerText(text),
      setSlashSelectedIndex: (index) => controlsRef.current?.setSlashSelectedIndex(index),
      prefillSkillChip: (skillName) => controlsRef.current?.prefillSkillChip(skillName),
    };
  }, [composerAutomationApiRef, split.focusedPaneComposerControlsRef]);

  useConversationSessionFocusComposer({
    composerSessionKey,
    focusComposer,
    enabled,
  });

  return null;
}

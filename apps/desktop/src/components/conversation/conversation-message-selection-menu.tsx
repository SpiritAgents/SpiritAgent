import { useCallback, type RefObject } from "react";
import { useTranslation } from "react-i18next";

import {
  TextSelectionActionMenu,
  TextSelectionActionMenuItem,
} from "@/components/text-selection-action-menu";
import { useTextSelectionActionMenu } from "@/hooks/use-text-selection-action-menu";
import type { MessageQuoteAttachment } from "@/lib/message-quote-attachment";

function makeMessageQuoteAttachment(selectedText: string): MessageQuoteAttachment {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    selectedText,
  };
}

/** Rewind 内联编辑器等 contenteditable 内的选区不触发引用菜单。 */
function isSelectionOutsideEditable(selection: Selection): boolean {
  for (const node of [selection.anchorNode, selection.focusNode]) {
    const element = node instanceof Element ? node : (node?.parentElement ?? null);
    if (element?.closest('[contenteditable="true"]')) {
      return false;
    }
  }
  return true;
}

export function ConversationMessageSelectionMenu({
  rootRef,
  onMessageQuoteAddToSession,
}: {
  rootRef: RefObject<HTMLElement | null>;
  onMessageQuoteAddToSession?: (attachment: MessageQuoteAttachment) => void;
}) {
  const { t } = useTranslation();
  const enabled = Boolean(onMessageQuoteAddToSession);
  const { open, setOpen, anchor, selectionText, dismiss } = useTextSelectionActionMenu({
    enabled,
    rootRef,
    isSelectionAllowed: isSelectionOutsideEditable,
  });

  const handleAddToSession = useCallback(() => {
    const selection = typeof window !== "undefined" ? window.getSelection() : null;
    if (!onMessageQuoteAddToSession) {
      dismiss();
      return;
    }

    const selectedText = (selectionText.trim() || selection?.toString() || "").trim();
    if (!selectedText) {
      dismiss();
      return;
    }

    onMessageQuoteAddToSession(makeMessageQuoteAttachment(selectedText));
    dismiss();
    selection?.removeAllRanges();
  }, [dismiss, onMessageQuoteAddToSession, selectionText]);

  if (!enabled) {
    return null;
  }

  return (
    <TextSelectionActionMenu
      open={open && Boolean(selectionText.trim())}
      anchor={anchor}
      onOpenChange={setOpen}
    >
      <TextSelectionActionMenuItem
        label={t("workspace.addSelectionToSession")}
        onSelect={handleAddToSession}
      />
    </TextSelectionActionMenu>
  );
}

import { useCallback, type RefObject } from "react";
import { useTranslation } from "react-i18next";

import {
  TextSelectionActionMenu,
  TextSelectionActionMenuItem,
  TextSelectionActionMenuSegmentedItems,
} from "@/components/text-selection-action-menu";
import { useTextSelectionActionMenu } from "@/hooks/use-text-selection-action-menu";
import type { MessageQuoteAttachment } from "@/lib/message-quote-attachment";

function makeMessageQuoteAttachment(selectedText: string): MessageQuoteAttachment {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    selectedText,
  };
}

/** Selections inside contenteditable such as the Rewind inline editor do not trigger the quote menu. */
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
  onMessageQuoteAddToSideChat,
}: {
  rootRef: RefObject<HTMLElement | null>;
  onMessageQuoteAddToSession?: (attachment: MessageQuoteAttachment) => void;
  onMessageQuoteAddToSideChat?: (attachment: MessageQuoteAttachment) => void;
}) {
  const { t } = useTranslation();
  const enabled = Boolean(onMessageQuoteAddToSession);
  const { open, setOpen, anchor, selectionText, dismiss } = useTextSelectionActionMenu({
    enabled,
    rootRef,
    isSelectionAllowed: isSelectionOutsideEditable,
  });

  const confirmSelection = useCallback(
    (onAdd: ((attachment: MessageQuoteAttachment) => void) | undefined) => {
      const selection = typeof window !== "undefined" ? window.getSelection() : null;
      const selectedText = (selectionText.trim() || selection?.toString() || "").trim();
      if (!onAdd || !selectedText) {
        dismiss();
        return;
      }

      onAdd(makeMessageQuoteAttachment(selectedText));
      dismiss();
      selection?.removeAllRanges();
    },
    [dismiss, selectionText],
  );

  const handleAddToSession = useCallback(() => {
    confirmSelection(onMessageQuoteAddToSession);
  }, [confirmSelection, onMessageQuoteAddToSession]);

  const handleAddToSideChat = useCallback(() => {
    confirmSelection(onMessageQuoteAddToSideChat);
  }, [confirmSelection, onMessageQuoteAddToSideChat]);

  if (!enabled) {
    return null;
  }

  return (
    <TextSelectionActionMenu
      open={open && Boolean(selectionText.trim())}
      anchor={anchor}
      onOpenChange={setOpen}
    >
      {onMessageQuoteAddToSideChat ? (
        <TextSelectionActionMenuSegmentedItems
          segments={[
            { label: t("workspace.addSelectionToSession"), onSelect: handleAddToSession },
            { label: t("workspace.addSelectionToSideChat"), onSelect: handleAddToSideChat },
          ]}
        />
      ) : (
        <TextSelectionActionMenuItem
          label={t("workspace.addSelectionToSession")}
          onSelect={handleAddToSession}
        />
      )}
    </TextSelectionActionMenu>
  );
}

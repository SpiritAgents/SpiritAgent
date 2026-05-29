import { useEffect, useMemo, useState, type KeyboardEvent } from "react";

import { ComposerLocalFileStrip } from "@/components/composer-local-file-strip";
import { useLocalFileAttachmentPreviews } from "@/hooks/useLocalFileAttachmentPreviews";
import {
  isAttachmentOnlyDisplayText,
  localFileAttachmentsSnapshotKey,
  mergeComposerAttachmentViews,
  snapshotsToComposerAttachmentViews,
  type ComposerLocalFileAttachmentView,
} from "@/lib/local-file-attachments";
import { cn } from "@/lib/utils";
import type { ConversationMessageSnapshot } from "@/types";

type ReadLocalImagePreview = (filePath: string) => Promise<string | null>;

type UserMessageBubbleProps = {
  message: ConversationMessageSnapshot;
  userBubbleClassName: string;
  canStartRewind: boolean;
  onRewindStart(): void;
  readLocalImagePreviewDataUrl: ReadLocalImagePreview;
};

export function UserMessageBubble({
  message,
  userBubbleClassName,
  canStartRewind,
  onRewindStart,
  readLocalImagePreviewDataUrl,
}: UserMessageBubbleProps) {
  const attachmentSnapshotKey = localFileAttachmentsSnapshotKey(message.localFileAttachments);
  const initialViews = useMemo(
    () => snapshotsToComposerAttachmentViews(message.localFileAttachments),
    [attachmentSnapshotKey],
  );
  const [attachmentViews, setAttachmentViews] =
    useState<ComposerLocalFileAttachmentView[]>(initialViews);

  useEffect(() => {
    setAttachmentViews((previous) => mergeComposerAttachmentViews(previous, initialViews));
  }, [message.id, attachmentSnapshotKey, initialViews]);

  useLocalFileAttachmentPreviews(attachmentViews, setAttachmentViews, readLocalImagePreviewDataUrl);

  const showText =
    message.content.trim().length > 0 &&
    !isAttachmentOnlyDisplayText(message.content, message.localFileAttachments);
  const hasAttachments = attachmentViews.length > 0;

  if (!showText && !hasAttachments) {
    return null;
  }

  const rewindBubbleClassName = cn(
    canStartRewind &&
      "cursor-pointer transition-colors hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
  );

  const handleRewindKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRewindStart();
    }
  };

  return (
    <div className="flex w-full flex-col items-end gap-1.5">
      {showText ? (
        <div
          data-spirit-surface="message-bubble"
          className={cn(userBubbleClassName, rewindBubbleClassName)}
          role={canStartRewind ? "button" : undefined}
          tabIndex={canStartRewind ? 0 : undefined}
          onClick={canStartRewind ? onRewindStart : undefined}
          onKeyDown={canStartRewind ? handleRewindKeyDown : undefined}
        >
          <pre className="m-0 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
            {message.content}
          </pre>
        </div>
      ) : null}
      {hasAttachments ? (
        <div
          className={cn("w-full", !showText && rewindBubbleClassName)}
          role={!showText && canStartRewind ? "button" : undefined}
          tabIndex={!showText && canStartRewind ? 0 : undefined}
          onClick={!showText && canStartRewind ? onRewindStart : undefined}
          onKeyDown={!showText && canStartRewind ? handleRewindKeyDown : undefined}
        >
          <ComposerLocalFileStrip
            readOnly
            attachments={attachmentViews}
            className="flex flex-wrap justify-end gap-1.5"
          />
        </div>
      ) : null}
    </div>
  );
}

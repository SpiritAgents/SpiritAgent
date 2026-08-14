export type ComposerLocalFileAttachmentView = {
  id?: string;
  path: string;
  name: string;
  isImage?: boolean;
  previewDataUrl?: string | null;
};

export function localFileAttachmentsSnapshotKey(
  attachments: readonly { path: string }[] | undefined,
): string {
  return (attachments ?? []).map((item) => item.path).join("\0");
}

export function snapshotsToComposerAttachmentViews(
  attachments: readonly { path: string; name?: string }[] | undefined,
): ComposerLocalFileAttachmentView[] {
  return (attachments ?? []).map((attachment) => ({
    path: attachment.path,
    name: attachment.name ?? attachment.path.split(/[/\\]/).pop() ?? attachment.path,
    isImage: false,
    previewDataUrl: null,
  }));
}

export function mergeComposerAttachmentViews(
  previous: ComposerLocalFileAttachmentView[],
  next: ComposerLocalFileAttachmentView[],
): ComposerLocalFileAttachmentView[] {
  const byPath = new Map(previous.map((item) => [item.path, item]));
  for (const item of next) {
    byPath.set(item.path, item);
  }
  return [...byPath.values()];
}

export function isAttachmentOnlyDisplayText(
  _content: string,
  attachments: readonly { path: string }[] | undefined,
): boolean {
  return Boolean(attachments?.length);
}

import { createHeadlessEditor } from "@lexical/headless";
import type { LexicalEditor } from "lexical";

import {
  segmentsEqual,
  segmentsToMessageText,
  type RichSegment,
} from "@/lib/composer-segment-model";
import { COMPOSER_LEXICAL_NODES } from "@/lib/composer-lexical/composer-lexical-config";
import { editorStateToRichSegments } from "@/lib/composer-lexical/bridge/editor-to-rich-segments";
import { richSegmentsToEditorState } from "@/lib/composer-lexical/bridge/rich-segments-to-editor";

export { editorStateToRichSegments } from "@/lib/composer-lexical/bridge/editor-to-rich-segments";
export { richSegmentsToEditorState } from "@/lib/composer-lexical/bridge/rich-segments-to-editor";

export function createComposerLexicalEditor(): LexicalEditor {
  return createHeadlessEditor({
    namespace: "spirit-composer",
    nodes: [...COMPOSER_LEXICAL_NODES],
    onError(error: Error) {
      throw error;
    },
  });
}

export function richSegmentsRoundTrip(segments: readonly RichSegment[]): RichSegment[] {
  const editor = createComposerLexicalEditor();
  richSegmentsToEditorState(segments, editor);
  return editorStateToRichSegments(editor);
}

export function assertRichSegmentsRoundTrip(
  segments: readonly RichSegment[],
): boolean {
  const roundTripped = richSegmentsRoundTrip(segments);
  return segmentsEqual(segments, roundTripped);
}

export function assertMessageTextInvariant(segments: readonly RichSegment[]): boolean {
  const before = segmentsToMessageText([...segments]);
  const roundTripped = richSegmentsRoundTrip(segments);
  const after = segmentsToMessageText(roundTripped);
  return before === after;
}

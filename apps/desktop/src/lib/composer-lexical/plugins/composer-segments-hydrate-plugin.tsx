import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLayoutEffect, type RefObject } from "react";
import type { LexicalEditor } from "lexical";

import { caretAtEnd } from "@/lib/composer-segment-model";
import { richSegmentsToEditorState } from "@/lib/composer-lexical/bridge";
import { segmentCaretToLexicalSelection } from "@/lib/composer-lexical/caret";
import type { RichSegment } from "@/lib/composer-segment-model";

type ComposerSegmentsHydratePluginProps = {
  editorRef: RefObject<LexicalEditor | null>;
  segmentsRef: RefObject<RichSegment[]>;
  skipEditorSyncRef: RefObject<boolean>;
  mountHydratedRef: RefObject<boolean>;
};

/** One-shot mount hydrate: push current segment state into Lexical. */
export function ComposerSegmentsHydratePlugin({
  editorRef,
  segmentsRef,
  skipEditorSyncRef,
  mountHydratedRef,
}: ComposerSegmentsHydratePluginProps) {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    editorRef.current = editor;
    return () => {
      editorRef.current = null;
    };
  }, [editor, editorRef]);

  useLayoutEffect(() => {
    if (mountHydratedRef.current) {
      return;
    }
    mountHydratedRef.current = true;
    const segments = segmentsRef.current;
    skipEditorSyncRef.current = true;
    richSegmentsToEditorState(segments, editor);
    segmentCaretToLexicalSelection(editor, caretAtEnd(segments));
    skipEditorSyncRef.current = false;
  }, [editor, editorRef, mountHydratedRef, segmentsRef, skipEditorSyncRef]);

  return null;
}

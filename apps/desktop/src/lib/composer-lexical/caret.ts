import {
  $createRangeSelection,
  $getRoot,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  type ElementNode,
  type LexicalEditor,
  type RangeSelection,
} from "lexical";

import {
  caretAtEnd,
  type RichSegment,
  type SegmentCaret,
} from "@/lib/composer-segment-model";
import { $isSpiritChipNode } from "@/lib/composer-lexical/nodes/spirit-chip-node";
import { $isSpiritParagraphNode } from "@/lib/composer-lexical/nodes/spirit-paragraph-node";

function getComposerParagraph(): ElementNode | null {
  const firstChild = $getRoot().getFirstChild();
  if (!$isSpiritParagraphNode(firstChild) && !$isParagraphNode(firstChild)) {
    return null;
  }
  return firstChild;
}

export function lexicalSelectionToSegmentCaret(
  editor: LexicalEditor,
): SegmentCaret | null {
  let caret: SegmentCaret | null = null;
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
      return;
    }
    const paragraph = getComposerParagraph();
    if (!paragraph) {
      return;
    }

    const children = paragraph.getChildren();
    const anchorNode = selection.anchor.getNode();
    const anchorKey = anchorNode.getKey();

    for (let segmentIndex = 0; segmentIndex < children.length; segmentIndex += 1) {
      const child = children[segmentIndex];
      if (!$isTextNode(child) && !$isSpiritChipNode(child)) {
        continue;
      }
      if (child.getKey() === anchorKey) {
        caret = {
          segmentIndex,
          offset: $isTextNode(child) ? selection.anchor.offset : 0,
        };
        return;
      }
      if ($isTextNode(child) && child.isParentOf(anchorNode)) {
        caret = { segmentIndex, offset: selection.anchor.offset };
        return;
      }
    }
  });
  return caret;
}

function resolveCaretTarget(
  paragraph: ElementNode,
  caret: SegmentCaret,
): { nodeKey: string; offset: number } | null {
  const child = paragraph.getChildren()[caret.segmentIndex];
  if (!$isTextNode(child) && !$isSpiritChipNode(child)) {
    return null;
  }
  if ($isSpiritChipNode(child)) {
    const next = paragraph.getChildren()[caret.segmentIndex + 1];
    if ($isTextNode(next)) {
      return { nodeKey: next.getKey(), offset: Math.min(caret.offset, next.getTextContentSize()) };
    }
    return { nodeKey: child.getKey(), offset: 0 };
  }
  return {
    nodeKey: child.getKey(),
    offset: Math.min(caret.offset, child.getTextContentSize()),
  };
}

export function segmentCaretToLexicalSelection(
  editor: LexicalEditor,
  caret: SegmentCaret,
): void {
  editor.update(() => {
    const paragraph = getComposerParagraph();
    if (!paragraph) {
      return;
    }
    const target = resolveCaretTarget(paragraph, caret);
    if (!target) {
      return;
    }
    const selection: RangeSelection = $createRangeSelection();
    selection.anchor.set(target.nodeKey, target.offset, "text");
    selection.focus.set(target.nodeKey, target.offset, "text");
    $setSelection(selection);
  }, { discrete: true });
}

export function focusComposerAtEnd(editor: LexicalEditor, segments: RichSegment[]): void {
  segmentCaretToLexicalSelection(editor, caretAtEnd(segments));
  editor.focus();
}

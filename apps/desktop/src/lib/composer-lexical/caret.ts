import {
  $createRangeSelection,
  $getRoot,
  $getSelection,
  $isLineBreakNode,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type RangeSelection,
  type TextNode,
} from "lexical";

import type { SpiritChipPayload } from "@/lib/composer-lexical/spirit-chip-payload";
import {
  caretAtEnd,
  caretToPlainTextOffset,
  mergeAdjacentTextSegments,
  plainTextOffsetToCaret,
  workspaceFilePlainToken,
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

function chipPlainTextLength(payload: SpiritChipPayload): number {
  if (payload.kind === "workspaceFile") {
    return workspaceFilePlainToken(payload.path).length;
  }
  return 0;
}

function findNextTextNodeKey(children: LexicalNode[], fromIndex: number): string | null {
  for (let index = fromIndex; index < children.length; index += 1) {
    const child = children[index];
    if ($isTextNode(child)) {
      return child.getKey();
    }
  }
  return null;
}

/** Map Lexical caret to UTF-16 plain-text offset (matches segment model / composerText). */
export function lexicalSelectionToPlainTextOffset(editor: LexicalEditor): number | null {
  let result: number | null = null;
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
      return;
    }
    const paragraph = getComposerParagraph();
    if (!paragraph) {
      return;
    }

    const anchorNode = selection.anchor.getNode();
    const anchorKey = anchorNode.getKey();
    let offset = 0;

    for (const child of paragraph.getChildren()) {
      if ($isTextNode(child)) {
        if (child.getKey() === anchorKey || child.isParentOf(anchorNode)) {
          result = offset + selection.anchor.offset;
          return;
        }
        offset += child.getTextContentSize();
        continue;
      }
      if ($isLineBreakNode(child)) {
        offset += 1;
        continue;
      }
      if ($isSpiritChipNode(child)) {
        if (child.getKey() === anchorKey) {
          result = offset;
          return;
        }
        offset += chipPlainTextLength(child.getPayload());
      }
    }
  });
  return result;
}

function plainTextOffsetToLexicalTarget(
  paragraph: ElementNode,
  targetOffset: number,
): { nodeKey: string; offset: number } | null {
  const children = paragraph.getChildren();
  let plainOffset = 0;
  let lastTextNode: TextNode | null = null;

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]!;
    if ($isTextNode(child)) {
      const length = child.getTextContentSize();
      if (targetOffset <= plainOffset + length) {
        return { nodeKey: child.getKey(), offset: targetOffset - plainOffset };
      }
      plainOffset += length;
      lastTextNode = child;
      continue;
    }
    if ($isLineBreakNode(child)) {
      if (targetOffset <= plainOffset + 1) {
        if (targetOffset === plainOffset && lastTextNode) {
          return { nodeKey: lastTextNode.getKey(), offset: lastTextNode.getTextContentSize() };
        }
        const nextTextKey = findNextTextNodeKey(children, index + 1);
        if (nextTextKey) {
          return { nodeKey: nextTextKey, offset: 0 };
        }
        if (lastTextNode) {
          return { nodeKey: lastTextNode.getKey(), offset: lastTextNode.getTextContentSize() };
        }
        return null;
      }
      plainOffset += 1;
      continue;
    }
    if ($isSpiritChipNode(child)) {
      const length = chipPlainTextLength(child.getPayload());
      if (targetOffset <= plainOffset + length) {
        if (length === 0) {
          const nextTextKey = findNextTextNodeKey(children, index + 1);
          if (nextTextKey) {
            return { nodeKey: nextTextKey, offset: 0 };
          }
        }
        return { nodeKey: child.getKey(), offset: 0 };
      }
      plainOffset += length;
    }
  }

  if (lastTextNode) {
    return { nodeKey: lastTextNode.getKey(), offset: lastTextNode.getTextContentSize() };
  }
  return null;
}

export function lexicalSelectionToSegmentCaret(
  editor: LexicalEditor,
  segments: RichSegment[],
): SegmentCaret | null {
  const plainOffset = lexicalSelectionToPlainTextOffset(editor);
  const merged = mergeAdjacentTextSegments(segments);
  if (plainOffset === null) {
    return null;
  }
  return plainTextOffsetToCaret(merged, plainOffset);
}

export function segmentCaretToLexicalSelection(
  editor: LexicalEditor,
  segments: RichSegment[],
  caret: SegmentCaret,
): void {
  const merged = mergeAdjacentTextSegments(segments);
  const plainOffset = caretToPlainTextOffset(merged, caret);
  editor.update(
    () => {
      const paragraph = getComposerParagraph();
      if (!paragraph) {
        return;
      }
      const target = plainTextOffsetToLexicalTarget(paragraph, plainOffset);
      if (!target) {
        return;
      }
      const selection: RangeSelection = $createRangeSelection();
      selection.anchor.set(target.nodeKey, target.offset, "text");
      selection.focus.set(target.nodeKey, target.offset, "text");
      $setSelection(selection);
    },
    { discrete: true },
  );
}

export function focusComposerAtEnd(editor: LexicalEditor, segments: RichSegment[]): void {
  segmentCaretToLexicalSelection(editor, segments, caretAtEnd(segments));
  editor.focus();
}

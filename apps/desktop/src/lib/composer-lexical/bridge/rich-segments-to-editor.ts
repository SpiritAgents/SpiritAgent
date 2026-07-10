import {
  $createLineBreakNode,
  $createTextNode,
  $getRoot,
  $createParagraphNode,
  type LexicalEditor,
} from "lexical";

import {
  emptySegments,
  mergeAdjacentTextSegments,
  type RichSegment,
} from "@/lib/composer-segment-model";
import { isSpiritChipPayload } from "@/lib/composer-lexical/spirit-chip-payload";
import { $createSpiritChipNode } from "@/lib/composer-lexical/nodes/spirit-chip-node";

function appendTextValueToParagraph(
  paragraph: ReturnType<typeof $createParagraphNode>,
  value: string,
): void {
  if (value.length === 0) {
    paragraph.append($createTextNode(""));
    return;
  }

  const lines = value.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    if (line.length > 0) {
      paragraph.append($createTextNode(line));
    }
    if (index < lines.length - 1) {
      paragraph.append($createLineBreakNode());
    }
  }
}

function appendSegmentToParagraph(
  paragraph: ReturnType<typeof $createParagraphNode>,
  segment: RichSegment,
): void {
  if (segment.kind === "text") {
    appendTextValueToParagraph(paragraph, segment.value);
    return;
  }
  if (isSpiritChipPayload(segment)) {
    paragraph.append($createSpiritChipNode(segment));
  }
}

/** Hydrate a Lexical editor from RichSegment[] (single paragraph). */
export function richSegmentsToEditorState(
  segments: readonly RichSegment[],
  editor: LexicalEditor,
): void {
  const merged = mergeAdjacentTextSegments(
    segments.length > 0 ? [...segments] : emptySegments(),
  );

  editor.update(() => {
    const root = $getRoot();
    root.clear();
    const paragraph = $createParagraphNode();

    for (const segment of merged) {
      appendSegmentToParagraph(paragraph, segment);
    }

    if (paragraph.getChildrenSize() === 0) {
      paragraph.append($createTextNode(""));
    }

    root.append(paragraph);
  }, { discrete: true });
}

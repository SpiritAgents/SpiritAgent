import { makeChipNode } from "@/lib/browser-element-chip-styles";
import type { RichSegment } from "@/lib/composer-segment-model";
import {
  emptySegments,
  isComposerPlainEmpty,
  segmentsToPlainText,
  syncSegmentsFromExternalValue,
} from "@/lib/composer-segment-model";
import { makeLoopChipNode } from "@/lib/loop-chip-styles";

export {
  caretAtEnd,
  emptySegments,
  insertSegmentAtCaret,
  isComposerPlainEmpty,
  mergeAdjacentTextSegments,
  normalizeComposerPlain,
  segmentsEqual,
  segmentsToAttachments,
  segmentsToMessageText,
  segmentsToPlainText,
  syncSegmentsFromExternalValue,
  type RichSegment,
  type SegmentCaret,
} from "@/lib/composer-segment-model";

export {
  ensureLoopPinned,
  hasLoopSegment,
  insertLoopSegment,
  isCaretAtLoopRemovalPoint,
  removeLoopSegment,
} from "@/lib/composer-loop-segments";

export { makeChipNode } from "@/lib/browser-element-chip-styles";
export { makeLoopChipNode } from "@/lib/loop-chip-styles";

function mergeTextIntoLast(segs: RichSegment[], chunk: string): void {
  const last = segs[segs.length - 1];
  if (last?.kind === "text") {
    last.value += chunk;
  } else {
    segs.push({ kind: "text", value: chunk });
  }
}

/** Read-only: contenteditable DOM → segments (preserves whitespace text nodes). */
export function domToSegments(root: HTMLElement): RichSegment[] {
  const segs: RichSegment[] = [];
  appendSegmentsFromChildren(root, segs);
  const last = segs[segs.length - 1];
  if (last?.kind === "text" && last.value.endsWith("\n")) {
    last.value = last.value.slice(0, -1);
    if (!last.value) segs.pop();
  }
  if (isComposerPlainEmpty(segmentsToPlainText(segs))) {
    return emptySegments();
  }
  return segs.length > 0 ? segs : emptySegments();
}

function appendSegmentsFromChildren(container: Node, segs: RichSegment[]): void {
  container.childNodes.forEach((node) => appendSegmentFromNode(node, segs));
}

function appendSegmentFromNode(node: Node, segs: RichSegment[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    segs.push({ kind: "text", value: node.textContent ?? "" });
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }
  const el = node as HTMLElement;
  if (el.dataset.loopChip === "true" || el.getAttribute("data-loop-chip") === "true") {
    segs.push({ kind: "loop" });
    return;
  }
  if (el.dataset.elementChip === "true" || el.getAttribute("data-element-chip") === "true") {
    const id = el.dataset.elementId;
    const tag = el.dataset.elementTag;
    const html = el.dataset.elementHtml;
    const url = el.dataset.elementUrl;
    if (id && tag && html !== undefined && url !== undefined) {
      segs.push({
        kind: "element",
        attachment: { id, tagName: tag, outerHtml: html, screenshotDataUrl: "", pageUrl: url },
      });
    }
    return;
  }
  if (el.tagName === "BR") {
    mergeTextIntoLast(segs, "\n");
    return;
  }
  if (el.tagName === "DIV" || el.tagName === "P") {
    appendSegmentsFromChildren(el, segs);
  }
}

export function segmentsToDom(
  segs: RichSegment[],
  doc: Document,
  opts?: { loopLabel?: string },
): DocumentFragment {
  const frag = doc.createDocumentFragment();
  for (const seg of segs) {
    if (seg.kind === "text") {
      const lines = seg.value.split("\n");
      lines.forEach((line, i) => {
        frag.appendChild(doc.createTextNode(line));
        if (i < lines.length - 1) {
          frag.appendChild(doc.createElement("br"));
        }
      });
    } else if (seg.kind === "loop") {
      frag.appendChild(makeLoopChipNode(doc, opts?.loopLabel ?? "Loop"));
    } else {
      frag.appendChild(makeChipNode(seg.attachment, doc));
    }
  }
  return frag;
}

export function renderSegmentsToElement(
  root: HTMLElement,
  segs: RichSegment[],
  opts?: { loopLabel?: string },
): void {
  root.replaceChildren(segmentsToDom(segs, root.ownerDocument, opts));
}

export function applyExternalTextValue(segs: RichSegment[], value: string): RichSegment[] {
  return syncSegmentsFromExternalValue(segs, value);
}

import type { BrowserElementAttachment } from "./browser-element-attachment";

export type RichSegment =
  | { kind: "text"; value: string }
  | { kind: "element"; attachment: BrowserElementAttachment };

export const EMPTY_TEXT_SEGMENT: RichSegment = { kind: "text", value: "" };

export function emptySegments(): RichSegment[] {
  return [{ kind: "text", value: "" }];
}

export function mergeAdjacentTextSegments(segs: RichSegment[]): RichSegment[] {
  const out: RichSegment[] = [];
  for (const seg of segs) {
    if (seg.kind === "text") {
      const prev = out[out.length - 1];
      if (prev?.kind === "text") {
        prev.value += seg.value;
      } else {
        out.push({ kind: "text", value: seg.value });
      }
    } else {
      out.push(seg);
    }
  }
  return out.length > 0 ? out : emptySegments();
}

export function segmentsToPlainText(segs: RichSegment[]): string {
  return segs.map((s) => (s.kind === "text" ? s.value : "")).join("");
}

export function segmentsToAttachments(segs: RichSegment[]): BrowserElementAttachment[] {
  return segs
    .filter((s): s is Extract<RichSegment, { kind: "element" }> => s.kind === "element")
    .map((s) => s.attachment);
}

/** Keep in sync with browserElementContextText in browser-element-attachment.ts */
function elementContextText(attachment: BrowserElementAttachment): string {
  return `Selected element from ${attachment.pageUrl}:\n\`\`\`html\n${attachment.outerHtml}\n\`\`\``;
}

export function segmentsToMessageText(segs: RichSegment[]): string {
  const parts: string[] = [];
  for (const seg of segs) {
    if (seg.kind === "text") {
      if (seg.value) parts.push(seg.value);
    } else {
      parts.push(elementContextText(seg.attachment));
    }
  }
  return parts.join("\n\n");
}

export function segmentsEqual(a: RichSegment[], b: RichSegment[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((seg, i) => {
    const other = b[i];
    if (seg.kind !== other.kind) return false;
    if (seg.kind === "text" && other.kind === "text") {
      return seg.value === other.value;
    }
    if (seg.kind === "element" && other.kind === "element") {
      return seg.attachment.id === other.attachment.id;
    }
    return false;
  });
}

export function syncSegmentsFromExternalValue(segs: RichSegment[], value: string): RichSegment[] {
  const elements = segs.filter((s): s is Extract<RichSegment, { kind: "element" }> => s.kind === "element");
  if (elements.length === 0) {
    return value ? [{ kind: "text", value }] : emptySegments();
  }
  if (!value) {
    return emptySegments();
  }
  const out: RichSegment[] = [];
  let textApplied = false;
  for (const seg of segs) {
    if (seg.kind === "element") {
      out.push(seg);
    } else if (!textApplied) {
      out.push({ kind: "text", value });
      textApplied = true;
    }
  }
  if (!textApplied) {
    out.unshift({ kind: "text", value });
  }
  return mergeAdjacentTextSegments(out);
}

export type SegmentCaret = {
  segmentIndex: number;
  offset: number;
};

export function insertSegmentAtCaret(
  segs: RichSegment[],
  caret: SegmentCaret,
  newSegment: RichSegment,
): { segments: RichSegment[]; caret: SegmentCaret } {
  const merged = mergeAdjacentTextSegments(segs);
  let index = Math.min(Math.max(caret.segmentIndex, 0), Math.max(merged.length - 1, 0));
  const seg = merged[index];

  let next: RichSegment[];

  if (seg?.kind === "text") {
    const before = seg.value.slice(0, caret.offset);
    const after = seg.value.slice(caret.offset);
    next = [
      ...merged.slice(0, index),
      ...(before ? [{ kind: "text" as const, value: before }] : []),
      newSegment,
      { kind: "text" as const, value: after },
      ...merged.slice(index + 1),
    ];
  } else if (seg?.kind === "element") {
    const insertAt = caret.offset === 0 ? index : index + 1;
    next = [
      ...merged.slice(0, insertAt),
      newSegment,
      { kind: "text" as const, value: "" },
      ...merged.slice(insertAt),
    ];
  } else {
    next = [newSegment, { kind: "text" as const, value: "" }];
  }

  const normalized = mergeAdjacentTextSegments(next);
  let afterIndex = normalized.length - 1;
  if (newSegment.kind === "element") {
    const elIndex = normalized.findIndex(
      (s) => s.kind === "element" && s.attachment.id === newSegment.attachment.id,
    );
    if (elIndex >= 0) {
      afterIndex = elIndex + 1;
    }
  }
  return {
    segments: normalized,
    caret: { segmentIndex: afterIndex, offset: 0 },
  };
}

export function caretAtEnd(segs: RichSegment[]): SegmentCaret {
  const merged = mergeAdjacentTextSegments(segs);
  const lastIndex = merged.length - 1;
  const last = merged[lastIndex];
  if (last?.kind === "text") {
    return { segmentIndex: lastIndex, offset: last.value.length };
  }
  return { segmentIndex: lastIndex + 1, offset: 0 };
}

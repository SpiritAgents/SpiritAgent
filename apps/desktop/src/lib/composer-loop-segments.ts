import type { RichSegment, SegmentCaret } from "./composer-segment-model";
import { emptySegments, mergeAdjacentTextSegments } from "./composer-segment-model";

export function hasLoopSegment(segs: RichSegment[]): boolean {
  return segs.some((s) => s.kind === "loop");
}

export function removeLoopSegment(segs: RichSegment[]): RichSegment[] {
  return mergeAdjacentTextSegments(segs.filter((s) => s.kind !== "loop"));
}

/** Keep at most one loop chip pinned at index 0. */
export function ensureLoopPinned(segs: RichSegment[]): RichSegment[] {
  if (!hasLoopSegment(segs)) {
    return mergeAdjacentTextSegments(segs);
  }
  const rest = segs.filter((s) => s.kind !== "loop");
  return mergeAdjacentTextSegments([{ kind: "loop" }, ...rest]);
}

/** Match element chip: add a trailing space when nothing follows the chip. */
function tailAfterLoopChip(rest: RichSegment[]): RichSegment[] {
  if (rest.length === 0) {
    return [{ kind: "text", value: " " }];
  }
  const first = rest[0];
  if (first?.kind === "text" && first.value === "") {
    return [{ kind: "text", value: " " }, ...rest.slice(1)];
  }
  return rest;
}

export function insertLoopSegment(segs: RichSegment[]): {
  segments: RichSegment[];
  caret: SegmentCaret;
} {
  const rest = removeLoopSegment(segs);
  const normalized = mergeAdjacentTextSegments([
    { kind: "loop" },
    ...tailAfterLoopChip(rest),
  ]);
  const textIndex = normalized.findIndex((s) => s.kind === "text");
  const caretSegmentIndex = textIndex >= 0 ? textIndex : normalized.length;
  const textSeg = textIndex >= 0 ? normalized[textIndex] : undefined;
  const caretOffset =
    textSeg?.kind === "text" && textSeg.value.startsWith(" ") ? 1 : 0;
  return {
    segments: normalized,
    caret: { segmentIndex: caretSegmentIndex, offset: caretOffset },
  };
}

export function caretAfterLoopChip(segs: RichSegment[]): SegmentCaret {
  const merged = mergeAdjacentTextSegments(segs);
  if (merged[0]?.kind !== "loop") {
    return { segmentIndex: 0, offset: 0 };
  }
  const textIndex = merged.findIndex((s, i) => i > 0 && s.kind === "text");
  if (textIndex >= 0) {
    const textSeg = merged[textIndex];
    const offset =
      textSeg?.kind === "text" && textSeg.value.startsWith(" ") ? 1 : 0;
    return { segmentIndex: textIndex, offset };
  }
  return { segmentIndex: 1, offset: 0 };
}

/** True when caret is immediately after the pinned loop chip (Backspace removes loop). */
export function isCaretAtLoopRemovalPoint(
  segs: RichSegment[],
  caret: SegmentCaret,
): boolean {
  const merged = mergeAdjacentTextSegments(segs);
  if (merged[0]?.kind !== "loop") {
    return false;
  }
  const at = merged[caret.segmentIndex];
  if (at?.kind === "text") {
    return caret.segmentIndex === 1 && caret.offset === 0;
  }
  return caret.segmentIndex === 1 && caret.offset === 0;
}

export function emptySegmentsWithOptionalLoop(loopEnabled: boolean): RichSegment[] {
  return loopEnabled ? insertLoopSegment(emptySegments()).segments : emptySegments();
}

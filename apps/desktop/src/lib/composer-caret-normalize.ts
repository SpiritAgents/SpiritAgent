import type { RichSegment, SegmentCaret } from "./composer-segment-model";
import { normalizeCaretForPinnedAgentModeChip } from "./composer-agent-mode-segments";
import { normalizeCaretForPinnedLoopChip } from "./composer-loop-segments";
import { normalizeCaretForInlineAttachmentChips } from "./composer-inline-chip-caret";

/** Single entry: snap DOM-reported carets to composer segment positions (matches Ask/Plan fix). */
export function normalizeCaretForComposer(
  segs: RichSegment[],
  caret: SegmentCaret | null,
): SegmentCaret {
  let next = normalizeCaretForPinnedLoopChip(segs, caret);
  next = normalizeCaretForPinnedAgentModeChip(segs, next);
  next = normalizeCaretForInlineAttachmentChips(segs, next);
  return next;
}

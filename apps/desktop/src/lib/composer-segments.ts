export {
  caretAtEnd,
  emptySegments,
  hasInlineAttachmentChipSegments,
  hasSkillSegment,
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
  ensureLoopChipTypingTail,
  ensureLoopPinned,
  hasLoopSegment,
  insertLoopSegment,
  isCaretAtLoopRemovalPoint,
  normalizeCaretForPinnedLoopChip,
  removeLoopSegment,
} from "@/lib/composer-loop-segments";

export {
  isCaretAtInlineChipRemovalPoint,
  normalizeCaretForInlineAttachmentChips,
  removeInlineChipAtRemovalPoint,
} from "@/lib/composer-inline-chip-caret";

export { normalizeCaretForComposer } from "@/lib/composer-caret-normalize";

export {
  isCaretOnStructuralChipLeadingSpacer,
  isStructuralChipInsertedSpacerOnly,
  structuralChipKindBeforeCaret,
  trimStructuralChipLeadingSpacerAtCaret,
} from "@/lib/composer-structural-chip-caret";

export {
  caretAfterAgentModeChip,
  currentAgentModeSegment,
  ensureAgentModePinned,
  hasAgentModeSegment,
  insertAgentModeSegment,
  isAgentModeChipKind,
  isCaretAtAgentModeRemovalPoint,
  normalizeCaretForPinnedAgentModeChip,
  removeAgentModeSegment,
} from "@/lib/composer-agent-mode-segments";

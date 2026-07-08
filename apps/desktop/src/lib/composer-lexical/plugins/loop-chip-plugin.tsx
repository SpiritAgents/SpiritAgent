import { useEffect, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

import { editorStateToRichSegments } from "@/lib/composer-lexical/bridge/editor-to-rich-segments";
import { richSegmentsToEditorState } from "@/lib/composer-lexical/bridge/rich-segments-to-editor";
import { normalizeComposerSegmentsPolicy } from "@/lib/composer-lexical/composer-lexical-policy";
import type { DesktopAgentMode } from "@/lib/agent-mode";
import {
  hasLoopSegment,
  insertLoopSegment,
  removeLoopSegment,
} from "@/lib/composer-loop-segments";
import {
  mergeAdjacentTextSegments,
  segmentsEqual,
  type RichSegment,
} from "@/lib/composer-segment-model";

type LoopChipPluginProps = {
  loopEnabled: boolean;
  agentMode: DesktopAgentMode;
  agentModeChipDismissed: boolean;
  skipEditorSyncRef: React.MutableRefObject<boolean>;
  onSegmentsNormalized(segments: RichSegment[]): void;
  onLoopEnabledChange?(enabled: boolean): void;
};

export function LoopChipPlugin({
  loopEnabled,
  agentMode,
  agentModeChipDismissed,
  skipEditorSyncRef,
  onSegmentsNormalized,
  onLoopEnabledChange,
}: LoopChipPluginProps) {
  const [editor] = useLexicalComposerContext();
  const prevLoopEnabledRef = useRef(false);

  useEffect(() => {
    const prev = prevLoopEnabledRef.current;
    prevLoopEnabledRef.current = loopEnabled;

    const raw = editorStateToRichSegments(editor);

    if (!loopEnabled) {
      if (prev && hasLoopSegment(raw)) {
        const stripped = normalizeComposerSegmentsPolicy(
          removeLoopSegment(raw),
          { agentMode, agentModeChipDismissed },
        );
        skipEditorSyncRef.current = true;
        richSegmentsToEditorState(stripped, editor);
        skipEditorSyncRef.current = false;
        onSegmentsNormalized(stripped);
        onLoopEnabledChange?.(false);
      }
      return;
    }

    if (!prev && !hasLoopSegment(raw)) {
      const { segments: inserted } = insertLoopSegment(mergeAdjacentTextSegments(raw));
      const next = normalizeComposerSegmentsPolicy(inserted, {
        agentMode,
        agentModeChipDismissed,
      });
      if (segmentsEqual(next, raw)) {
        return;
      }
      skipEditorSyncRef.current = true;
      richSegmentsToEditorState(next, editor);
      skipEditorSyncRef.current = false;
      onSegmentsNormalized(next);
    }
  }, [
    agentMode,
    agentModeChipDismissed,
    editor,
    loopEnabled,
    onLoopEnabledChange,
    onSegmentsNormalized,
    skipEditorSyncRef,
  ]);

  return null;
}

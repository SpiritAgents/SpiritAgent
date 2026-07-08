import { useEffect, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

import type { DesktopAgentMode } from "@/lib/agent-mode";
import {
  hasAgentModeSegment,
  insertAgentModeSegment,
  isAgentModeChipKind,
  type AgentModeChipKind,
} from "@/lib/composer-agent-mode-segments";
import { editorStateToRichSegments } from "@/lib/composer-lexical/bridge/editor-to-rich-segments";
import { richSegmentsToEditorState } from "@/lib/composer-lexical/bridge/rich-segments-to-editor";
import { normalizeComposerSegmentsPolicy } from "@/lib/composer-lexical/composer-lexical-policy";
import {
  mergeAdjacentTextSegments,
  segmentsEqual,
  type RichSegment,
} from "@/lib/composer-segment-model";
import { shouldPinAgentModeChip } from "@/lib/composer-agent-mode-policy";

type AgentModeChipPluginProps = {
  agentMode: DesktopAgentMode;
  agentModeChipDismissed: boolean;
  segmentsRef: React.MutableRefObject<RichSegment[]>;
  skipEditorSyncRef: React.MutableRefObject<boolean>;
  onSegmentsNormalized(segments: RichSegment[]): void;
  onAgentModeChipDismissChange?(dismissed: boolean): void;
  onAgentModeChange?(mode: DesktopAgentMode): void;
};

export function AgentModeChipPlugin({
  agentMode,
  agentModeChipDismissed,
  segmentsRef,
  skipEditorSyncRef,
  onSegmentsNormalized,
  onAgentModeChipDismissChange,
  onAgentModeChange,
}: AgentModeChipPluginProps) {
  const [editor] = useLexicalComposerContext();
  const prevAgentModeRef = useRef(agentMode);
  const dismissedRef = useRef(agentModeChipDismissed);

  useEffect(() => {
    dismissedRef.current = agentModeChipDismissed;
  }, [agentModeChipDismissed]);

  useEffect(() => {
    const prev = prevAgentModeRef.current;
    prevAgentModeRef.current = agentMode;

    if (!isAgentModeChipKind(agentMode)) {
      if (isAgentModeChipKind(prev) && hasAgentModeSegment(editorStateToRichSegments(editor))) {
        const raw = editorStateToRichSegments(editor);
        const next = normalizeComposerSegmentsPolicy(raw, {
          agentMode,
          agentModeChipDismissed: true,
        });
        skipEditorSyncRef.current = true;
        richSegmentsToEditorState(next, editor);
        skipEditorSyncRef.current = false;
        onSegmentsNormalized(next);
        onAgentModeChange?.("agent");
      }
      return;
    }

    if (prev === agentMode || dismissedRef.current) {
      return;
    }

    const raw = editorStateToRichSegments(editor);
    const { segments: inserted } = insertAgentModeSegment(
      mergeAdjacentTextSegments(raw),
      agentMode as AgentModeChipKind,
    );
    const next = normalizeComposerSegmentsPolicy(inserted, {
      agentMode,
      agentModeChipDismissed: dismissedRef.current,
    });
    if (segmentsEqual(next, raw)) {
      return;
    }
    skipEditorSyncRef.current = true;
    richSegmentsToEditorState(next, editor);
    skipEditorSyncRef.current = false;
    dismissedRef.current = false;
    onAgentModeChipDismissChange?.(false);
    onSegmentsNormalized(next);
  }, [
    agentMode,
    editor,
    onAgentModeChange,
    onAgentModeChipDismissChange,
    onSegmentsNormalized,
    skipEditorSyncRef,
  ]);

  useEffect(() => {
    if (!shouldPinAgentModeChip({ hostMode: agentMode, dismissed: agentModeChipDismissed })) {
      return;
    }
    const raw = editorStateToRichSegments(editor);
    const next = normalizeComposerSegmentsPolicy(raw, {
      agentMode,
      agentModeChipDismissed,
    });
    if (segmentsEqual(next, raw)) {
      return;
    }
    skipEditorSyncRef.current = true;
    richSegmentsToEditorState(next, editor);
    skipEditorSyncRef.current = false;
    if (!segmentsEqual(next, segmentsRef.current)) {
      onSegmentsNormalized(next);
    }
  }, [agentMode, agentModeChipDismissed, editor, onSegmentsNormalized, segmentsRef, skipEditorSyncRef]);

  return null;
}

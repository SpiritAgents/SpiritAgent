import type { DesktopAgentMode } from "@/lib/agent-mode";
import {
  applyAgentModeChipPolicy,
  type AgentModeChipPolicy,
} from "@/lib/composer-agent-mode-policy";
import {
  mergeAdjacentTextSegments,
  type RichSegment,
} from "@/lib/composer-segment-model";
import {
  ensureLoopChipTypingTail,
  ensureLoopPinned,
} from "@/lib/composer-loop-segments";

export type StructuralChipPolicyOptions = {
  agentMode: DesktopAgentMode;
  agentModeChipDismissed: boolean;
};

/** Single entry: pin loop + agent-mode chips on segment state (Lexical path). */
export function normalizeComposerSegmentsPolicy(
  segments: readonly RichSegment[],
  policy: StructuralChipPolicyOptions,
): RichSegment[] {
  const agentPolicy: AgentModeChipPolicy = {
    hostMode: policy.agentMode,
    dismissed: policy.agentModeChipDismissed,
  };
  return applyAgentModeChipPolicy(
    ensureLoopChipTypingTail(ensureLoopPinned(mergeAdjacentTextSegments([...segments]))),
    agentPolicy,
  );
}

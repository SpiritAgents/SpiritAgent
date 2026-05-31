import type { ToolBlockSnapshot } from '../types.js';

/** Minimal 工具卡在 preview / 待审批 / running 阶段显示与 Thinking 一致的 shimmer。 */
export function toolCallPhaseShowsShimmer(phase: ToolBlockSnapshot['phase']): boolean {
  return phase === 'preview' || phase === 'pending-approval' || phase === 'running';
}

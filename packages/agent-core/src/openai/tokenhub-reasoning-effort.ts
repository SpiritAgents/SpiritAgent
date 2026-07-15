import type { ModelReasoningEffortContext } from '../reasoning-effort.js';
import { normalizeUpstreamModelId } from './thinking-switch-disabled-models.js';

const TOKEN_HUB_REASONING_EFFORT_MODEL_IDS = new Set([
  'hy3',
  'hy3-preview',
  'deepseek-v4-flash',
  'deepseek-v4-pro',
  'deepseek-v3.2',
]);

export function isTokenHubReasoningEffortModel(
  context?: ModelReasoningEffortContext,
): boolean {
  if (context?.provider !== 'tencent-tokenhub') {
    return false;
  }
  return TOKEN_HUB_REASONING_EFFORT_MODEL_IDS.has(
    normalizeUpstreamModelId(context.model ?? ''),
  );
}

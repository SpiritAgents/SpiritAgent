/** 去 gateway 前缀并 lowercase，用于跨提供商模型名能力匹配。 */
export function normalizeUpstreamModelId(model: string): string {
  const normalized = model.trim().toLowerCase();
  const slashIndex = normalized.lastIndexOf('/');
  return slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
}

const THINKING_SWITCH_DISABLED_MODEL_IDS = new Set([
  'minimax-m2.5',
  'minimax-m2.7',
]);

/** MiniMax M2.5/M2.7 等：thinking 常开且不可 disabled（TokenHub / MiniMax 文档一致）。 */
export function isThinkingSwitchDisabledModel(model: string): boolean {
  return THINKING_SWITCH_DISABLED_MODEL_IDS.has(normalizeUpstreamModelId(model));
}

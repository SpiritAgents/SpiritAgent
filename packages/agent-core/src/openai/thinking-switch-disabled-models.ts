/** Strips the gateway prefix and lowercases, for cross-provider model-name capability matching. */
export function normalizeUpstreamModelId(model: string): string {
  const normalized = model.trim().toLowerCase();
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
}

const THINKING_SWITCH_DISABLED_MODEL_IDS = new Set(["minimax-m2.5", "minimax-m2.7"]);

/** MiniMax M2.5/M2.7 etc.: thinking is always on and cannot be disabled (consistent across TokenHub / MiniMax docs). */
export function isThinkingSwitchDisabledModel(model: string): boolean {
  return THINKING_SWITCH_DISABLED_MODEL_IDS.has(normalizeUpstreamModelId(model));
}

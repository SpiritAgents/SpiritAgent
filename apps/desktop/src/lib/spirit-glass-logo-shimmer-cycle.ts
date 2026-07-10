/** 与 `.spirit-launch-shimmer-sweep` 的 `animation-duration` 保持一致 */
export const SPIRIT_GLASS_LOGO_SHIMMER_CYCLE_MS = 2900;

export function computeShimmerStopDelayMs(
  elapsedMs: number,
  cycleMs: number = SPIRIT_GLASS_LOGO_SHIMMER_CYCLE_MS,
): number {
  const normalizedElapsed = ((elapsedMs % cycleMs) + cycleMs) % cycleMs;
  return cycleMs - normalizedElapsed;
}

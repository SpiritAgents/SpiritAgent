/**
 * 首启引导（OOBE）门控：仅根据宿主快照与持久化标志决定是否显示向导。
 */

export type OnboardingVisibilityInput = {
  /** 宿主快照是否就绪；未就绪时向导仍可显示欢迎步，但 Done/Continue 等需等待快照。 */
  snapshotReady: boolean;
  /** 持久化的「首启引导已完成」标志（config.json）。 */
  onboardingCompleted: boolean;
  /** 本次会话内已点击 Done 关闭。 */
  dismissedThisSession: boolean;
};

/** 是否应进入 OOBE 流程（不依赖 snapshot 是否就绪）。 */
export function resolveOnboardingExpected(
  input: Omit<OnboardingVisibilityInput, "snapshotReady">,
): boolean {
  if (input.dismissedThisSession) {
    return false;
  }
  return !input.onboardingCompleted;
}

export function resolveOnboardingVisible(input: OnboardingVisibilityInput): boolean {
  if (!input.snapshotReady) {
    return false;
  }
  return resolveOnboardingExpected(input);
}

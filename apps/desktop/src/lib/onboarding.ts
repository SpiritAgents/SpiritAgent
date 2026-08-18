/**
 * First-run onboarding (OOBE) gating: decides whether to show the wizard based only on the host snapshot and persisted flags.
 */

export type OnboardingVisibilityInput = {
  /** Whether the host snapshot is ready; before it is ready the wizard may still show the welcome step, but Done/Continue must wait for the snapshot. */
  snapshotReady: boolean;
  /** Persisted "first-run onboarding completed" flag (config.json). */
  onboardingCompleted: boolean;
  /** Done was clicked to close during this session. */
  dismissedThisSession: boolean;
};

/** Whether the OOBE flow should be entered (independent of whether the snapshot is ready). */
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

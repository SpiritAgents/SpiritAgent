import assert from "node:assert/strict";
import test from "node:test";

import { resolveOnboardingExpected, resolveOnboardingVisible } from "../../src/lib/onboarding.ts";

test("resolveOnboardingExpected shows wizard before snapshot is ready", () => {
  assert.equal(
    resolveOnboardingExpected({
      onboardingCompleted: false,
      dismissedThisSession: false,
    }),
    true,
  );
});

test("resolveOnboardingExpected hides wizard once onboarding completed", () => {
  assert.equal(
    resolveOnboardingExpected({
      onboardingCompleted: true,
      dismissedThisSession: false,
    }),
    false,
  );
});

test("resolveOnboardingExpected never re-shows after dismissal in the same session", () => {
  assert.equal(
    resolveOnboardingExpected({
      onboardingCompleted: false,
      dismissedThisSession: true,
    }),
    false,
  );
});

test("resolveOnboardingVisible shows wizard when onboarding not completed", () => {
  assert.equal(
    resolveOnboardingVisible({
      snapshotReady: true,
      onboardingCompleted: false,
      dismissedThisSession: false,
    }),
    true,
  );
});

test("resolveOnboardingVisible hides wizard once onboarding completed", () => {
  assert.equal(
    resolveOnboardingVisible({
      snapshotReady: true,
      onboardingCompleted: true,
      dismissedThisSession: false,
    }),
    false,
  );
});

test("resolveOnboardingVisible hides wizard before snapshot is ready", () => {
  assert.equal(
    resolveOnboardingVisible({
      snapshotReady: false,
      onboardingCompleted: false,
      dismissedThisSession: false,
    }),
    false,
  );
});

test("resolveOnboardingVisible never re-shows after dismissal in the same session", () => {
  assert.equal(
    resolveOnboardingVisible({
      snapshotReady: true,
      onboardingCompleted: false,
      dismissedThisSession: true,
    }),
    false,
  );
});

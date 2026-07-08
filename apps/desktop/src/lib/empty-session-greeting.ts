import type { TFunction } from "i18next";

export const EMPTY_SESSION_GREETING_PLAIN_VARIANTS = ["startSomething", "letsBuild"] as const;

export const EMPTY_SESSION_GREETING_WORKSPACE_VARIANT = "doSomethingIn" as const;

export type EmptySessionGreetingPlainVariantId =
  (typeof EMPTY_SESSION_GREETING_PLAIN_VARIANTS)[number];

export type EmptySessionGreetingVariantId =
  | EmptySessionGreetingPlainVariantId
  | typeof EMPTY_SESSION_GREETING_WORKSPACE_VARIANT;

export function emptySessionGreetingPool(
  includeWorkspaceVariants: boolean,
): readonly EmptySessionGreetingVariantId[] {
  if (includeWorkspaceVariants) {
    return [...EMPTY_SESSION_GREETING_PLAIN_VARIANTS, EMPTY_SESSION_GREETING_WORKSPACE_VARIANT];
  }
  return EMPTY_SESSION_GREETING_PLAIN_VARIANTS;
}

export function pickEmptySessionGreetingVariant(options: {
  includeWorkspaceVariants: boolean;
  random?: () => number;
}): EmptySessionGreetingVariantId {
  const pool = emptySessionGreetingPool(options.includeWorkspaceVariants);
  const random = options.random ?? Math.random;
  const index = Math.floor(random() * pool.length);
  return pool[Math.min(index, pool.length - 1)]!;
}

const greetingVariantBySessionKey = new Map<string, EmptySessionGreetingVariantId>();

type PendingNavGreeting = {
  navGeneration: number;
  variantId: EmptySessionGreetingVariantId;
};

let pendingNavGreeting: PendingNavGreeting | null = null;

export function normalizeEmptySessionGreetingSessionKey(sessionKey: string): string {
  return sessionKey.trim() || "__no-session__";
}

/** Roll and retain a greeting for in-flight session navigation before composerSessionKey updates. */
export function beginEmptySessionGreetingNavigation(
  navGeneration: number,
  options: {
    includeWorkspaceVariants: boolean;
    random?: () => number;
  },
): EmptySessionGreetingVariantId {
  const variantId = pickEmptySessionGreetingVariant(options);
  pendingNavGreeting = { navGeneration, variantId };
  return variantId;
}

export function activeEmptySessionGreetingNavigationVariant(
  navGeneration: number,
): EmptySessionGreetingVariantId | null {
  if (pendingNavGreeting?.navGeneration === navGeneration) {
    return pendingNavGreeting.variantId;
  }
  return null;
}

export function commitEmptySessionGreetingNavigation(
  navGeneration: number,
  sessionKey: string,
): void {
  if (pendingNavGreeting?.navGeneration !== navGeneration) {
    return;
  }
  greetingVariantBySessionKey.set(
    normalizeEmptySessionGreetingSessionKey(sessionKey),
    pendingNavGreeting.variantId,
  );
  pendingNavGreeting = null;
}

export function cancelEmptySessionGreetingNavigation(navGeneration: number): void {
  if (pendingNavGreeting?.navGeneration === navGeneration) {
    pendingNavGreeting = null;
  }
}

/** Stable per-session variant; shared across hook instances so panes do not re-roll independently. */
export function resolveEmptySessionGreetingVariantForSession(
  sessionKey: string,
  options: {
    includeWorkspaceVariants: boolean;
    random?: () => number;
  },
): EmptySessionGreetingVariantId {
  const normalizedKey = normalizeEmptySessionGreetingSessionKey(sessionKey);
  let variantId = greetingVariantBySessionKey.get(normalizedKey);
  if (!variantId) {
    variantId = pickEmptySessionGreetingVariant(options);
    greetingVariantBySessionKey.set(normalizedKey, variantId);
  }
  return variantId;
}

export function resetEmptySessionGreetingStateForTests(): void {
  greetingVariantBySessionKey.clear();
  pendingNavGreeting = null;
}

export function resolveEmptySessionGreeting(
  t: TFunction,
  variantId: EmptySessionGreetingVariantId,
  workspaceLabel: string | null,
): string {
  return t(`app.emptySessionGreeting.${variantId}`, {
    workspace: workspaceLabel ?? "",
  });
}

export function isWorkspaceGreetingVariant(variantId: string): boolean {
  return variantId === EMPTY_SESSION_GREETING_WORKSPACE_VARIANT;
}

/** Demo-only fake sessions for @ Sessions drill-in (no Transport). */

export type DemoSessionReference = {
  id: string;
  /** i18n key under composer.atReference.* */
  titleKey: string;
};

export const DEMO_SESSION_REFERENCES: readonly DemoSessionReference[] = [
  { id: "demo-session-1", titleKey: "composer.atReference.demoSession1" },
  { id: "demo-session-2", titleKey: "composer.atReference.demoSession2" },
  { id: "demo-session-3", titleKey: "composer.atReference.demoSession3" },
  { id: "demo-session-4", titleKey: "composer.atReference.demoSession4" },
  { id: "demo-session-5", titleKey: "composer.atReference.demoSession5" },
  { id: "demo-session-6", titleKey: "composer.atReference.demoSession6" },
] as const;

export const AT_REFERENCE_EMPTY_QUERY_FILE_LIMIT = 3;

export type AtReferenceMenuView = "root" | "sessions";

export type AtReferenceMenuItem =
  | { kind: "file"; path: string }
  | { kind: "sessions-entry" }
  | { kind: "back" }
  | { kind: "session"; path: string; title: string };

export function atReferenceNeedle(rawQuery: string): string {
  return rawQuery.replace(/^@/u, "").trim().toLowerCase();
}

export function filterDemoSessionsByNeedle(
  sessions: readonly DemoSessionReference[],
  needle: string,
  resolveTitle: (titleKey: string) => string,
): Array<{ path: string; title: string }> {
  const resolved = sessions.map((session) => ({
    path: session.id,
    title: resolveTitle(session.titleKey),
  }));
  if (!needle) {
    return resolved;
  }
  return resolved.filter((session) => session.title.toLowerCase().includes(needle));
}

export function buildAtReferenceMenuItems(input: {
  view: AtReferenceMenuView;
  rawQuery: string;
  fileSuggestions: readonly string[];
  resolveTitle: (titleKey: string) => string;
}): AtReferenceMenuItem[] {
  const needle = atReferenceNeedle(input.rawQuery);

  if (input.view === "sessions") {
    const sessions = filterDemoSessionsByNeedle(
      DEMO_SESSION_REFERENCES,
      needle,
      input.resolveTitle,
    ).map((session) => ({
      kind: "session" as const,
      path: session.path,
      title: session.title,
    }));
    return [{ kind: "back" }, ...sessions];
  }

  if (!needle) {
    const files = input.fileSuggestions
      .slice(0, AT_REFERENCE_EMPTY_QUERY_FILE_LIMIT)
      .map((path) => ({ kind: "file" as const, path }));
    return [...files, { kind: "sessions-entry" }];
  }

  const files = input.fileSuggestions.map((path) => ({ kind: "file" as const, path }));
  const sessions = filterDemoSessionsByNeedle(
    DEMO_SESSION_REFERENCES,
    needle,
    input.resolveTitle,
  ).map((session) => ({
    kind: "session" as const,
    path: session.path,
    title: session.title,
  }));
  return [...files, ...sessions];
}

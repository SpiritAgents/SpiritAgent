/** Builder for Composer @ reference menu (files + session drill-in). */

import type { SessionListItem } from "@/types";

export const AT_REFERENCE_EMPTY_QUERY_FILE_LIMIT = 3;

export type AtReferenceMenuView = "root" | "sessions";

export type AtReferenceMenuItem =
  | { kind: "file"; path: string }
  | { kind: "sessions-entry" }
  | { kind: "back" }
  | { kind: "session"; path: string; title: string };

export type AtReferenceSessionCandidate = {
  /** Absolute transcript.json path used in the chip wire. */
  path: string;
  title: string;
  /** Chat archive path; used to exclude the active session. */
  chatPath: string;
};

export function atReferenceNeedle(rawQuery: string): string {
  return rawQuery.replace(/^@/u, "").trim().toLowerCase();
}

export function sessionCandidatesFromListItems(
  sessions: readonly SessionListItem[],
  excludeChatPath?: string | null,
): AtReferenceSessionCandidate[] {
  const excluded = excludeChatPath?.trim() ? excludeChatPath.replace(/\\/gu, "/") : "";
  const out: AtReferenceSessionCandidate[] = [];
  for (const session of sessions) {
    const chatPath = session.path.replace(/\\/gu, "/");
    if (excluded && chatPath === excluded) {
      continue;
    }
    const transcriptPath = session.transcriptPath?.trim();
    if (!transcriptPath) {
      continue;
    }
    const title = session.displayName.trim() || chatPath;
    out.push({
      path: transcriptPath.replace(/\\/gu, "/"),
      title,
      chatPath,
    });
  }
  return out;
}

export function filterSessionCandidatesByNeedle(
  sessions: readonly AtReferenceSessionCandidate[],
  needle: string,
): AtReferenceSessionCandidate[] {
  if (!needle) {
    return [...sessions];
  }
  return sessions.filter((session) => session.title.toLowerCase().includes(needle));
}

export function buildAtReferenceMenuItems(input: {
  view: AtReferenceMenuView;
  rawQuery: string;
  fileSuggestions: readonly string[];
  sessions: readonly AtReferenceSessionCandidate[];
}): AtReferenceMenuItem[] {
  const needle = atReferenceNeedle(input.rawQuery);
  const matchedSessions = filterSessionCandidatesByNeedle(input.sessions, needle).map(
    (session) => ({
      kind: "session" as const,
      path: session.path,
      title: session.title,
    }),
  );

  if (input.view === "sessions") {
    return [{ kind: "back" }, ...matchedSessions];
  }

  if (!needle) {
    const files = input.fileSuggestions
      .slice(0, AT_REFERENCE_EMPTY_QUERY_FILE_LIMIT)
      .map((path) => ({ kind: "file" as const, path }));
    return [...files, { kind: "sessions-entry" }];
  }

  const files = input.fileSuggestions.map((path) => ({ kind: "file" as const, path }));
  return [...files, ...matchedSessions];
}

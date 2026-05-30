/** Browser-safe mirror of host-internal resolveWorkspaceGroupingRoot (avoid barrel import in renderer). */
export function resolveWorkspaceGroupingRoot(workspaceRoot: string): string {
  const trimmed = workspaceRoot.trim();
  const asPosix = trimmed.replace(/\\/g, '/').replace(/\/+$/g, '');
  const match = asPosix.match(/^(.+)\.worktrees\/[^/]+$/u);
  if (match?.[1]) {
    return match[1];
  }
  return asPosix || trimmed;
}

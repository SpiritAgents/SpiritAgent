import type { DesktopAvailableWorkspace, DesktopWorkspaceBinding } from "@/types/spirit-desktop";

function normalizeWorkspacePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();
}

export function sameWorkspacePath(left: string, right: string): boolean {
  return normalizeWorkspacePath(left) === normalizeWorkspacePath(right);
}

function deriveWorkspaceLabel(workspaceRoot: string): string {
  const normalized = workspaceRoot.replace(/\\/g, "/").replace(/\/+$/g, "");
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash >= 0 ? normalized.slice(lastSlash + 1) || normalized : normalized;
}

export function resolveWorkspaceDisplayLabel(
  workspaceRoot: string,
  workspaceBinding: DesktopWorkspaceBinding,
  availableWorkspaces: readonly DesktopAvailableWorkspace[],
): string | null {
  if (workspaceBinding === "none" || !workspaceRoot.trim()) {
    return null;
  }
  const matched = availableWorkspaces.find((workspace) =>
    sameWorkspacePath(workspace.path, workspaceRoot),
  );
  return matched?.label ?? deriveWorkspaceLabel(workspaceRoot);
}

export function resolveWorkspaceSelectorLabel(
  workspaceRoot: string,
  workspaceBinding: DesktopWorkspaceBinding,
  availableWorkspaces: readonly DesktopAvailableWorkspace[],
  t: (key: string) => string,
): string {
  if (workspaceBinding === "none") {
    return t("app.noWorkspace");
  }
  return resolveWorkspaceDisplayLabel(workspaceRoot, workspaceBinding, availableWorkspaces) ?? "";
}

import {
  addWorkspaceToolTab,
  findWorkspaceToolTab,
  focusFirstTabOfKind,
  type WorkspaceToolTab,
} from "@/lib/workspace-tool-tabs";

export type WorkspaceEditorViewMode = "edit" | "preview";

export type WorkspaceFileRevealRequest = {
  relativePath: string;
  viewMode: WorkspaceEditorViewMode;
};

export type ResolveWorkspaceFilesTabResult = {
  tabs: WorkspaceToolTab[];
  activeTabId: string;
  filesTabId: string;
};

/** Pick active files tab, else first files tab, else create one. */
export function resolveWorkspaceFilesTab(
  tabs: readonly WorkspaceToolTab[],
  activeTabId: string,
): ResolveWorkspaceFilesTabResult {
  const activeTab = findWorkspaceToolTab(tabs, activeTabId);
  if (activeTab?.kind === "files") {
    return { tabs: [...tabs], activeTabId, filesTabId: activeTabId };
  }

  const firstFilesId = focusFirstTabOfKind(tabs, "files");
  if (firstFilesId) {
    return { tabs: [...tabs], activeTabId: firstFilesId, filesTabId: firstFilesId };
  }

  const added = addWorkspaceToolTab(tabs, "files");
  return {
    tabs: added.tabs,
    activeTabId: added.activeId,
    filesTabId: added.activeId,
  };
}

export type OpenWorkspaceFileNavigationInput = {
  tabs: readonly WorkspaceToolTab[];
  activeTabId: string;
  request: WorkspaceFileRevealRequest;
};

export type OpenWorkspaceFileNavigationResult = ResolveWorkspaceFilesTabResult & {
  reveal: WorkspaceFileRevealRequest;
};

export function buildOpenWorkspaceFileNavigation(
  input: OpenWorkspaceFileNavigationInput,
): OpenWorkspaceFileNavigationResult {
  const resolved = resolveWorkspaceFilesTab(input.tabs, input.activeTabId);
  return {
    ...resolved,
    reveal: input.request,
  };
}

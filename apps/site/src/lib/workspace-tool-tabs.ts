export type WorkspaceToolTabKind = "files" | "shell" | "git" | "browser";

export const BROWSER_NEW_TAB_SENTINEL = "__spirit_browser_new_tab__";

/** Design-mode browser preview address bar (hero demo). */
export const DESIGN_MODE_BROWSER_URL = "https://localhost:5173";

export type WorkspaceToolTab = {
  id: string;
  kind: WorkspaceToolTabKind;
  browserUrl?: string;
  tabTitle?: string;
};

function newTabId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isBrowserNewTabUrl(url: string | undefined): boolean {
  return url === BROWSER_NEW_TAB_SENTINEL || url === undefined || url === "";
}

export function createWorkspaceToolTab(kind: WorkspaceToolTabKind): WorkspaceToolTab {
  const tab: WorkspaceToolTab = { id: newTabId(), kind };
  if (kind === "browser") {
    tab.browserUrl = BROWSER_NEW_TAB_SENTINEL;
  }
  return tab;
}

export function createDefaultWorkspaceToolTabs(includeBrowser = false): WorkspaceToolTab[] {
  const kinds: WorkspaceToolTabKind[] = ["files", "shell", "git"];
  if (includeBrowser) {
    kinds.push("browser");
  }
  return kinds.map((kind) => createWorkspaceToolTab(kind));
}

export function createInitialWorkspaceToolsState(includeBrowser = false): {
  tabs: WorkspaceToolTab[];
  activeTabId: string;
} {
  const tabs = createDefaultWorkspaceToolTabs(includeBrowser);
  return { tabs, activeTabId: defaultActiveWorkspaceToolTabId(tabs, includeBrowser) };
}

export function defaultActiveWorkspaceToolTabId(
  tabs: WorkspaceToolTab[],
  preferBrowser = false,
): string {
  if (preferBrowser) {
    const browser = tabs.find((tab) => tab.kind === "browser");
    if (browser) {
      return browser.id;
    }
  }
  const files = tabs.find((tab) => tab.kind === "files");
  return files?.id ?? tabs[0]?.id ?? "";
}

export function focusFirstTabOfKind(
  tabs: readonly WorkspaceToolTab[],
  kind: WorkspaceToolTabKind,
): string | null {
  return tabs.find((tab) => tab.kind === kind)?.id ?? null;
}

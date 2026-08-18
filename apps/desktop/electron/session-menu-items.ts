import type { MenuItemConstructorOptions } from "electron";

import i18nHost from "../src/lib/i18n-host.js";
import {
  TRAY_MORE_LIMIT,
  TRAY_RECENT_LIMIT,
  pickRecentSessions,
  truncateJumpListTitle,
} from "../src/lib/windows-jump-list-build.js";
import type { SessionListItem } from "../src/types.js";

export function deriveWorkspaceLabel(workspaceRoot: string | null | undefined): string {
  if (!workspaceRoot?.trim()) {
    return "";
  }
  const normalized = workspaceRoot.replace(/\\/g, "/").replace(/\/+$/g, "");
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash >= 0 ? normalized.slice(lastSlash + 1) || normalized : normalized;
}

export function buildSessionMenuItem(
  session: SessionListItem,
  onOpen: (sessionPath: string) => void,
): MenuItemConstructorOptions {
  const title = truncateJumpListTitle(session.displayName || session.path);
  if (process.platform === "darwin") {
    const workspaceLabel = deriveWorkspaceLabel(session.workspaceRoot);
    if (workspaceLabel) {
      // Known limitation: Tray menus display the sublabel (workspace name); the macOS Dock
      // context menu does not support sublabel and ignores the field. It is still written to
      // stay consistent with how menu-bar session items are constructed.
      return {
        label: title,
        sublabel: workspaceLabel,
        click: () => {
          void onOpen(session.path);
        },
      };
    }
  }
  return {
    label: title,
    click: () => {
      void onOpen(session.path);
    },
  };
}

/** The 5 most recent sessions plus a "More" submenu (up to 10), shared by Tray / Dock. */
export function buildRecentSessionMenuItems(
  sessions: readonly SessionListItem[],
  onOpen: (sessionPath: string) => void,
): MenuItemConstructorOptions[] {
  const recent = pickRecentSessions(sessions, TRAY_RECENT_LIMIT);
  const more = pickRecentSessions(sessions, TRAY_MORE_LIMIT);
  return [
    ...recent.map((session) => buildSessionMenuItem(session, onOpen)),
    {
      label: i18nHost.t("tray.more"),
      submenu: more.map((session) => buildSessionMenuItem(session, onOpen)),
    },
  ];
}

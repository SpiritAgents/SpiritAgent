import type { MenuItemConstructorOptions } from 'electron';

import i18nHost from '../src/lib/i18n-host.js';
import {
  TRAY_MORE_LIMIT,
  TRAY_RECENT_LIMIT,
  pickRecentSessions,
  truncateJumpListTitle,
} from '../src/lib/windows-jump-list-build.js';
import type { SessionListItem } from '../src/types.js';

export function deriveWorkspaceLabel(workspaceRoot: string | null | undefined): string {
  if (!workspaceRoot?.trim()) {
    return '';
  }
  const normalized = workspaceRoot.replace(/\\/g, '/').replace(/\/+$/g, '');
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash >= 0 ? normalized.slice(lastSlash + 1) || normalized : normalized;
}

export function buildSessionMenuItem(
  session: SessionListItem,
  onOpen: (sessionPath: string) => void,
): MenuItemConstructorOptions {
  const title = truncateJumpListTitle(session.displayName || session.path);
  if (process.platform === 'darwin') {
    const workspaceLabel = deriveWorkspaceLabel(session.workspaceRoot);
    if (workspaceLabel) {
      // 已知限制：Tray 菜单会显示 sublabel（工作区名）；macOS Dock 右键菜单不支持
      // sublabel，同一字段会被忽略。为与菜单栏会话项构造保持一致，仍写入该字段。
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

/** 最近 5 条会话 +「更多」子菜单（最多 10 条），供 Tray / Dock 共用。 */
export function buildRecentSessionMenuItems(
  sessions: readonly SessionListItem[],
  onOpen: (sessionPath: string) => void,
): MenuItemConstructorOptions[] {
  const recent = pickRecentSessions(sessions, TRAY_RECENT_LIMIT);
  const more = pickRecentSessions(sessions, TRAY_MORE_LIMIT);
  return [
    ...recent.map((session) => buildSessionMenuItem(session, onOpen)),
    {
      label: i18nHost.t('tray.more'),
      submenu: more.map((session) => buildSessionMenuItem(session, onOpen)),
    },
  ];
}

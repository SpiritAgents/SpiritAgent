import { Menu, app } from 'electron';

import { invokeDesktopHostCommand } from '../src/host/service.js';
import type { SessionListItem } from '../src/types.js';

import { buildRecentSessionMenuItems } from './session-menu-items.js';

export type MacOSDockMenuDeps = {
  openSession: (sessionPath: string) => void | Promise<void>;
};

let depsStore: MacOSDockMenuDeps | undefined;
let syncInFlight: Promise<void> | undefined;
let disposed = false;
let syncGeneration = 0;

function isSyncStale(generation: number): boolean {
  return disposed || generation !== syncGeneration;
}

function buildDockMenu(sessions: readonly SessionListItem[], deps: MacOSDockMenuDeps): Menu {
  const openSession = (sessionPath: string) => {
    void deps.openSession(sessionPath);
  };
  // 插在系统「窗口」列表与「选项」之间；系统已在该区段上下加分割线，勿再包一层 separator。
  return Menu.buildFromTemplate(buildRecentSessionMenuItems(sessions, openSession));
}

async function syncMacOSDockMenuUnlocked(
  deps: MacOSDockMenuDeps,
  generation: number,
): Promise<void> {
  if (isSyncStale(generation)) {
    return;
  }
  if (process.platform !== 'darwin' || !app.dock) {
    return;
  }

  let sessions: SessionListItem[] = [];
  try {
    const listed = await invokeDesktopHostCommand('listSessions');
    sessions = Array.isArray(listed) ? (listed as SessionListItem[]) : [];
  } catch (error) {
    console.warn('[spirit-desktop] dock menu listSessions failed:', error);
  }

  if (isSyncStale(generation)) {
    return;
  }

  app.dock.setMenu(buildDockMenu(sessions, deps));
}

export function bindMacOSDockMenuDeps(deps: MacOSDockMenuDeps): void {
  if (disposed) {
    return;
  }
  depsStore = deps;
}

export async function syncMacOSDockMenu(deps?: MacOSDockMenuDeps): Promise<void> {
  if (disposed) {
    return;
  }
  const resolved = deps ?? depsStore;
  if (!resolved) {
    return;
  }
  depsStore = resolved;
  if (syncInFlight) {
    await syncInFlight;
  }
  if (disposed) {
    return;
  }
  const generation = syncGeneration;
  syncInFlight = syncMacOSDockMenuUnlocked(resolved, generation).finally(() => {
    syncInFlight = undefined;
  });
  await syncInFlight;
}

export function disposeMacOSDockMenu(): void {
  disposed = true;
  syncGeneration += 1;
  depsStore = undefined;
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setMenu(Menu.buildFromTemplate([]));
  }
}

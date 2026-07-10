import { webContents, type WebContents } from 'electron';

import { toggleBrowserWindowFullScreen } from './window-fullscreen.js';

type GuestF12Registration = {
  host: WebContents;
  tabId: string;
  onBeforeInput: (event: Electron.Event, input: Electron.Input) => void;
};

const f12ByGuestId = new Map<number, GuestF12Registration>();

/**
 * IPC 传入的 webContentsId 可为任意值；存活目标必须是 <webview> guest 且其宿主
 * （embedder）为发起 IPC 的 sender，防止渲染进程操纵其他窗口 / 主窗口的 webContents。
 * 目标已销毁（如 tab 关闭竞态）时返回 null，由调用方决定是否视为无效。
 */
function findOwnedWebviewGuest(host: WebContents, guestWebContentsId: number): WebContents | null {
  const guest = webContents.fromId(guestWebContentsId);
  if (!guest || guest.isDestroyed()) {
    return null;
  }
  if (guest.getType() !== 'webview' || guest.hostWebContents?.id !== host.id) {
    throw new Error('Invalid browser guest webContents');
  }
  return guest;
}

function requireOwnedWebviewGuest(host: WebContents, guestWebContentsId: number): WebContents {
  const guest = findOwnedWebviewGuest(host, guestWebContentsId);
  if (!guest) {
    throw new Error('Invalid browser guest webContents');
  }
  return guest;
}

export function registerBrowserGuestF12(
  host: WebContents,
  tabId: string,
  guestWebContentsId: number,
): void {
  unregisterBrowserGuestF12(host, guestWebContentsId);
  const guest = requireOwnedWebviewGuest(host, guestWebContentsId);

  const onBeforeInput = (event: Electron.Event, input: Electron.Input) => {
    if (input.type !== 'keyDown') {
      return;
    }

    if (process.platform === 'win32' && input.key === 'F11') {
      event.preventDefault();
      toggleBrowserWindowFullScreen(host);
      return;
    }

    if (input.key === 'F12') {
      event.preventDefault();
      if (!host.isDestroyed()) {
        host.send('desktop:browser-guest-f12', { tabId });
      }
    }
  };

  guest.on('before-input-event', onBeforeInput);
  f12ByGuestId.set(guestWebContentsId, { host, tabId, onBeforeInput });
}

export function unregisterBrowserGuestF12(host: WebContents, guestWebContentsId: number): void {
  const registration = f12ByGuestId.get(guestWebContentsId);
  if (!registration || registration.host.id !== host.id) {
    return;
  }
  const guest = webContents.fromId(guestWebContentsId);
  if (guest && !guest.isDestroyed()) {
    guest.removeListener('before-input-event', registration.onBeforeInput);
  }
  f12ByGuestId.delete(guestWebContentsId);
}

export function bindBrowserGuestDevtools(
  host: WebContents,
  pageGuestId: number,
  devtoolsGuestId: number,
): void {
  const page = requireOwnedWebviewGuest(host, pageGuestId);
  const devtools = requireOwnedWebviewGuest(host, devtoolsGuestId);
  page.setDevToolsWebContents(devtools);
}

export function openBrowserGuestDevtools(host: WebContents, pageGuestId: number): boolean {
  const page = findOwnedWebviewGuest(host, pageGuestId);
  if (!page || page.isDevToolsOpened()) {
    return false;
  }
  page.openDevTools({ mode: 'detach', activate: true });
  return true;
}

export function closeBrowserGuestDevtools(host: WebContents, pageGuestId: number): void {
  const page = findOwnedWebviewGuest(host, pageGuestId);
  if (!page || !page.isDevToolsOpened()) {
    return;
  }
  page.closeDevTools();
}

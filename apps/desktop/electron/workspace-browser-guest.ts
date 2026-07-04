import { webContents, type WebContents } from 'electron';

type GuestF12Registration = {
  host: WebContents;
  tabId: string;
  onBeforeInput: (event: Electron.Event, input: Electron.Input) => void;
};

const f12ByGuestId = new Map<number, GuestF12Registration>();

export function registerBrowserGuestF12(
  host: WebContents,
  tabId: string,
  guestWebContentsId: number,
): void {
  unregisterBrowserGuestF12(guestWebContentsId);
  const guest = webContents.fromId(guestWebContentsId);
  if (!guest || guest.isDestroyed()) {
    throw new Error('Invalid browser guest webContents');
  }

  const onBeforeInput = (event: Electron.Event, input: Electron.Input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      event.preventDefault();
      if (!host.isDestroyed()) {
        host.send('desktop:browser-guest-f12', { tabId });
      }
    }
  };

  guest.on('before-input-event', onBeforeInput);
  f12ByGuestId.set(guestWebContentsId, { host, tabId, onBeforeInput });
}

export function unregisterBrowserGuestF12(guestWebContentsId: number): void {
  const registration = f12ByGuestId.get(guestWebContentsId);
  if (!registration) {
    return;
  }
  const guest = webContents.fromId(guestWebContentsId);
  if (guest && !guest.isDestroyed()) {
    guest.removeListener('before-input-event', registration.onBeforeInput);
  }
  f12ByGuestId.delete(guestWebContentsId);
}

export function bindBrowserGuestDevtools(
  pageGuestId: number,
  devtoolsGuestId: number,
): void {
  const page = webContents.fromId(pageGuestId);
  const devtools = webContents.fromId(devtoolsGuestId);
  if (!page || page.isDestroyed() || !devtools || devtools.isDestroyed()) {
    throw new Error('Invalid browser devtools bind target');
  }
  page.setDevToolsWebContents(devtools);
}

export function openBrowserGuestDevtools(pageGuestId: number): boolean {
  const page = webContents.fromId(pageGuestId);
  if (!page || page.isDestroyed() || page.isDevToolsOpened()) {
    return false;
  }
  page.openDevTools({ mode: 'detach', activate: true });
  return true;
}

export function closeBrowserGuestDevtools(pageGuestId: number): void {
  const page = webContents.fromId(pageGuestId);
  if (!page || page.isDestroyed() || !page.isDevToolsOpened()) {
    return;
  }
  page.closeDevTools();
}

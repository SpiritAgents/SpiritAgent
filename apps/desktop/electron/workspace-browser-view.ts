import { BrowserView, BrowserWindow, type WebContents } from 'electron';

import { isAllowedExternalUrl } from './local-listeners.js';

export type PageViewBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PageViewSyncPayload = {
  tabId: string;
  bounds: PageViewBounds;
  visible: boolean;
  url?: string;
};

export type BrowserPageEvent =
  | { tabId: string; type: 'url'; url: string }
  | { tabId: string; type: 'title'; title: string }
  | { tabId: string; type: 'nav-state'; canGoBack: boolean; canGoForward: boolean };

type PageViewSession = {
  tabId: string;
  browserView: BrowserView;
  devtoolsBrowserView: BrowserView | undefined;
  attached: boolean;
  devtoolsAttached: boolean;
  devtoolsOpen: boolean;
  devtoolsTargetSet: boolean;
  lastUrl: string | undefined;
  pageBounds: PageViewBounds;
};

const pageViewHooksAttached = new WeakSet<WebContents>();
const sessionsByKey = new Map<string, PageViewSession>();
const visibleTabByHostId = new Map<number, string>();

/** 与 workspace-browser-tab 原 devtools 槽位比例一致 */
const DEVTOOLS_WIDTH_RATIO = 0.42;

function sessionKey(hostId: number, tabId: string): string {
  return `${hostId}:${tabId}`;
}

function getHostWindow(host: WebContents): BrowserWindow | null {
  if (host.isDestroyed()) {
    return null;
  }
  try {
    const win = BrowserWindow.fromWebContents(host);
    if (!win || win.isDestroyed()) {
      return null;
    }
    return win;
  } catch {
    return null;
  }
}

function sendBrowserOpenUrl(host: WebContents, url: string): void {
  if (!isAllowedExternalUrl(url) || host.isDestroyed()) {
    return;
  }
  host.send('desktop:browser-open-url', { url });
}

function emitPageEvent(host: WebContents, event: BrowserPageEvent): void {
  if (host.isDestroyed()) {
    return;
  }
  host.send('desktop:browser-page-event', event);
}

function emitNavState(host: WebContents, tabId: string, page: WebContents): void {
  emitPageEvent(host, {
    tabId,
    type: 'nav-state',
    canGoBack: page.canGoBack(),
    canGoForward: page.canGoForward(),
  });
}

function createPageBrowserView(): BrowserView {
  return new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
}

function splitBoundsForDevtools(full: PageViewBounds): { page: PageViewBounds; devtools: PageViewBounds } {
  const devtoolsWidth = Math.max(1, Math.round(full.width * DEVTOOLS_WIDTH_RATIO));
  const pageWidth = Math.max(1, full.width - devtoolsWidth);
  return {
    page: { x: full.x, y: full.y, width: pageWidth, height: full.height },
    devtools: {
      x: full.x + pageWidth,
      y: full.y,
      width: devtoolsWidth,
      height: full.height,
    },
  };
}

function reloadDevtoolsBrowserView(devtoolsView: BrowserView): void {
  void devtoolsView.webContents
    .executeJavaScript('window.location.reload()')
    .catch(() => devtoolsView.webContents.reload());
}

function detachDevtoolsBrowserView(host: WebContents, session: PageViewSession): void {
  const win = getHostWindow(host);
  if (win && session.devtoolsAttached && session.devtoolsBrowserView) {
    win.removeBrowserView(session.devtoolsBrowserView);
    session.devtoolsAttached = false;
  }
}

function applyPageLayout(host: WebContents, session: PageViewSession): void {
  const win = getHostWindow(host);
  if (!win || !session.attached) {
    return;
  }

  if (!session.devtoolsOpen || !session.devtoolsBrowserView) {
    session.browserView.setBounds(session.pageBounds);
    detachDevtoolsBrowserView(host, session);
    return;
  }

  const { page, devtools } = splitBoundsForDevtools(session.pageBounds);
  session.browserView.setBounds(page);
  if (!session.devtoolsAttached) {
    win.addBrowserView(session.devtoolsBrowserView);
    session.devtoolsAttached = true;
  }
  session.devtoolsBrowserView.setBounds(devtools);
}

function closeEmbeddedDevtools(host: WebContents, session: PageViewSession): void {
  const page = session.browserView.webContents;
  if (!page.isDestroyed() && page.isDevToolsOpened()) {
    page.closeDevTools();
  }
  session.devtoolsOpen = false;
  detachDevtoolsBrowserView(host, session);
  applyPageLayout(host, session);
}

function openEmbeddedDevtools(host: WebContents, session: PageViewSession): void {
  const page = session.browserView.webContents;
  if (page.isDestroyed()) {
    return;
  }

  if (!session.devtoolsBrowserView) {
    session.devtoolsBrowserView = createPageBrowserView();
    session.devtoolsTargetSet = false;
  }

  if (!session.devtoolsTargetSet) {
    page.setDevToolsWebContents(session.devtoolsBrowserView.webContents);
    session.devtoolsTargetSet = true;
  }

  session.devtoolsOpen = true;
  applyPageLayout(host, session);

  if (!page.isDevToolsOpened()) {
    // Win32 titleBarOverlay 会强制原生 dock 变 detach（electron/electron#42079），
    // 故用 setDevToolsWebContents 将 DevTools 画进右侧 BrowserView。
    page.openDevTools({ mode: 'detach', activate: true });
    reloadDevtoolsBrowserView(session.devtoolsBrowserView);
  }
}

function attachPageViewHandlers(host: WebContents, tabId: string, page: WebContents): void {
  if (pageViewHooksAttached.has(page)) {
    return;
  }
  pageViewHooksAttached.add(page);

  page.setWindowOpenHandler((details) => {
    if (details.url) {
      sendBrowserOpenUrl(host, details.url);
    }
    return { action: 'deny' };
  });

  page.on('will-navigate', (event, url) => {
    const current = page.getURL();
    if (!current || current === 'about:blank') {
      return;
    }
    try {
      const currentOrigin = new URL(current).origin;
      const nextOrigin = new URL(url).origin;
      if (currentOrigin !== nextOrigin) {
        event.preventDefault();
        sendBrowserOpenUrl(host, url);
      }
    } catch {
      // ignore malformed URLs
    }
  });

  page.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      event.preventDefault();
      togglePageDevTools(host, tabId);
    }
  });

  const onNavigate = (_event: unknown, url: string) => {
    if (url && url !== 'about:blank') {
      emitPageEvent(host, { tabId, type: 'url', url });
    }
    emitNavState(host, tabId, page);
  };

  page.on('did-navigate', onNavigate);
  page.on('did-navigate-in-page', onNavigate);
  page.on('did-stop-loading', () => {
    const url = page.getURL();
    if (url && url !== 'about:blank') {
      emitPageEvent(host, { tabId, type: 'url', url });
    }
    emitNavState(host, tabId, page);
  });

  page.on('page-title-updated', (_event, title) => {
    emitPageEvent(host, { tabId, type: 'title', title: title || '' });
  });
}

function getSession(host: WebContents, tabId: string): PageViewSession | undefined {
  return sessionsByKey.get(sessionKey(host.id, tabId));
}

function getOrCreateSession(host: WebContents, tabId: string): PageViewSession {
  const key = sessionKey(host.id, tabId);
  let session = sessionsByKey.get(key);
  if (!session) {
    const browserView = createPageBrowserView();
    attachPageViewHandlers(host, tabId, browserView.webContents);
    session = {
      tabId,
      browserView,
      devtoolsBrowserView: undefined,
      attached: false,
      devtoolsAttached: false,
      devtoolsOpen: false,
      devtoolsTargetSet: false,
      lastUrl: undefined,
      pageBounds: { x: 0, y: 0, width: 0, height: 0 },
    };
    sessionsByKey.set(key, session);
  }
  return session;
}

/** 仅从窗口摘下 BrowserView，保留 webContents 与导航状态（工具栏折叠用） */
function hidePageView(host: WebContents, session: PageViewSession): void {
  closeEmbeddedDevtools(host, session);
  const win = getHostWindow(host);
  if (win && session.attached) {
    win.removeBrowserView(session.browserView);
    session.attached = false;
  }
}

function hideOtherPageViews(host: WebContents, activeTabId: string): void {
  for (const [key, session] of sessionsByKey) {
    if (!key.startsWith(`${host.id}:`) || session.tabId === activeTabId) {
      continue;
    }
    hidePageView(host, session);
  }
}

function attachSession(host: WebContents, session: PageViewSession, bounds: PageViewBounds): void {
  const win = getHostWindow(host);
  if (!win) {
    throw new Error('No host window for browser page view');
  }
  if (!session.attached) {
    win.addBrowserView(session.browserView);
    session.attached = true;
  }
  session.pageBounds = bounds;
  applyPageLayout(host, session);
  visibleTabByHostId.set(host.id, session.tabId);
}

export function syncPageView(host: WebContents, payload: PageViewSyncPayload): void {
  const { tabId, bounds, visible, url } = payload;
  if (!tabId) {
    throw new Error('Invalid browser tab id');
  }

  const session = getOrCreateSession(host, tabId);

  if (!visible) {
    hidePageView(host, session);
    if (visibleTabByHostId.get(host.id) === tabId) {
      visibleTabByHostId.delete(host.id);
    }
    if (bounds.width >= 1 && bounds.height >= 1) {
      session.pageBounds = bounds;
    }
    return;
  }

  if (bounds.width < 1 || bounds.height < 1) {
    return;
  }

  hideOtherPageViews(host, tabId);
  attachSession(host, session, bounds);

  const page = session.browserView.webContents;
  if (page.isDestroyed()) {
    return;
  }
  if (url && url !== session.lastUrl) {
    session.lastUrl = url;
    if (page.getURL() !== url) {
      void page.loadURL(url);
    }
  } else if (!page.getURL() || page.getURL() === 'about:blank') {
    if (url) {
      session.lastUrl = url;
      void page.loadURL(url);
    }
  }
}

export function navigatePageView(
  host: WebContents,
  tabId: string,
  action: 'back' | 'forward' | 'reload' | 'load',
  url?: string,
): void {
  const session = getSession(host, tabId);
  if (!session) {
    return;
  }
  const page = session.browserView.webContents;
  if (page.isDestroyed()) {
    return;
  }
  switch (action) {
    case 'back':
      if (page.canGoBack()) {
        page.goBack();
      }
      break;
    case 'forward':
      if (page.canGoForward()) {
        page.goForward();
      }
      break;
    case 'reload':
      page.reload();
      break;
    case 'load':
      if (url) {
        session.lastUrl = url;
        void page.loadURL(url);
      }
      break;
    default:
      break;
  }
}

export function togglePageDevTools(host: WebContents, tabId: string): void {
  const session = getSession(host, tabId);
  if (!session || !session.attached) {
    return;
  }
  if (session.devtoolsOpen) {
    closeEmbeddedDevtools(host, session);
    return;
  }
  openEmbeddedDevtools(host, session);
}

export async function executeInPageView(
  host: WebContents,
  tabId: string,
  script: string,
): Promise<unknown> {
  const session = getSession(host, tabId);
  if (!session) {
    throw new Error('Browser page view not found');
  }
  return session.browserView.webContents.executeJavaScript(script);
}

export async function insertCssInPageView(
  host: WebContents,
  tabId: string,
  css: string,
): Promise<string> {
  const session = getSession(host, tabId);
  if (!session) {
    throw new Error('Browser page view not found');
  }
  return session.browserView.webContents.insertCSS(css);
}

export async function removeInsertedCssInPageView(
  host: WebContents,
  tabId: string,
  key: string,
): Promise<void> {
  const session = getSession(host, tabId);
  if (!session) {
    return;
  }
  await session.browserView.webContents.removeInsertedCSS(key);
}

export async function capturePageView(
  host: WebContents,
  tabId: string,
  rect: PageViewBounds,
): Promise<string> {
  const session = getSession(host, tabId);
  if (!session) {
    throw new Error('Browser page view not found');
  }
  const image = await session.browserView.webContents.capturePage(rect);
  return image.toPNG().toString('base64');
}

function destroyBrowserViewContents(browserView: BrowserView): void {
  if (!browserView.webContents.isDestroyed()) {
    browserView.webContents.close();
  }
}

function destroySessionContents(session: PageViewSession): void {
  destroyBrowserViewContents(session.browserView);
  if (session.devtoolsBrowserView) {
    destroyBrowserViewContents(session.devtoolsBrowserView);
  }
}

export function destroyPageView(host: WebContents, tabId: string): void {
  const key = sessionKey(host.id, tabId);
  const session = sessionsByKey.get(key);
  if (!session) {
    return;
  }
  hidePageView(host, session);
  destroySessionContents(session);
  sessionsByKey.delete(key);
  if (visibleTabByHostId.get(host.id) === tabId) {
    visibleTabByHostId.delete(host.id);
  }
}

export function destroyAllPageViewsForHostId(hostId: number): void {
  const prefix = `${hostId}:`;
  for (const [key, session] of [...sessionsByKey.entries()]) {
    if (!key.startsWith(prefix)) {
      continue;
    }
    destroySessionContents(session);
    sessionsByKey.delete(key);
  }
  visibleTabByHostId.delete(hostId);
}

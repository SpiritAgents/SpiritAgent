export type WebviewCaptureRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BrowserPageEventHandlers = {
  onUrl?: (url: string) => void;
  onTitle?: (title: string) => void;
  onNavState?: (canGoBack: boolean, canGoForward: boolean) => void;
  onToggleDevtools?: () => void;
};

export function browserWebviewPartition(tabId: string): string {
  return `persist:spirit-browser-${tabId}`;
}

export const BROWSER_WEBVIEW_WEBPREFERENCES = "contextIsolation=yes, sandbox=yes";

export function waitForWebviewDomReady(wv: SpiritWebviewTag): Promise<void> {
  return new Promise((resolve) => {
    const onReady = () => {
      wv.removeEventListener("dom-ready", onReady);
      resolve();
    };
    wv.addEventListener("dom-ready", onReady);
  });
}

export function attachBrowserNavigationPolicy(
  wv: SpiritWebviewTag,
  onExternalUrl: (url: string) => void,
): () => void {
  const onWillNavigate = (event: unknown) => {
    if (
      typeof event !== "object" ||
      event === null ||
      !("url" in event) ||
      typeof (event as { url: unknown }).url !== "string"
    ) {
      return;
    }
    const navigateEvent = event as SpiritWebviewWillNavigateEvent;
    const current = wv.getURL();
    if (!current || current === "about:blank") {
      return;
    }
    try {
      const currentOrigin = new URL(current).origin;
      const nextOrigin = new URL(navigateEvent.url).origin;
      if (currentOrigin !== nextOrigin) {
        navigateEvent.preventDefault();
        onExternalUrl(navigateEvent.url);
      }
    } catch {
      // ignore malformed URLs
    }
  };

  const onNewWindow = (event: unknown) => {
    if (typeof event !== "object" || event === null) {
      return;
    }
    const newWindowEvent = event as SpiritWebviewNewWindowEvent;
    newWindowEvent.preventDefault();
    if (newWindowEvent.url) {
      onExternalUrl(newWindowEvent.url);
    }
  };

  wv.addEventListener("will-navigate", onWillNavigate);
  wv.addEventListener("new-window", onNewWindow);

  return () => {
    wv.removeEventListener("will-navigate", onWillNavigate);
    wv.removeEventListener("new-window", onNewWindow);
  };
}

export function attachBrowserPageEventListeners(
  wv: SpiritWebviewTag,
  handlers: BrowserPageEventHandlers,
): () => void {
  const emitNavState = () => {
    handlers.onNavState?.(wv.canGoBack(), wv.canGoForward());
  };

  const onNavigate = (_event: unknown, url: unknown) => {
    if (typeof url === "string" && url && url !== "about:blank") {
      handlers.onUrl?.(url);
    }
    emitNavState();
  };

  const onTitle = (event: unknown) => {
    const title =
      typeof event === "object" && event !== null && "title" in event
        ? String((event as { title?: string }).title ?? "")
        : "";
    handlers.onTitle?.(title);
  };

  const onStopLoading = () => {
    const url = wv.getURL();
    if (url && url !== "about:blank") {
      handlers.onUrl?.(url);
    }
    emitNavState();
  };

  wv.addEventListener("did-navigate", onNavigate);
  wv.addEventListener("did-navigate-in-page", onNavigate);
  wv.addEventListener("page-title-updated", onTitle);
  wv.addEventListener("did-stop-loading", onStopLoading);

  const guest = wv.getWebContents();
  const onBeforeInput = (
    event: { preventDefault: () => void },
    input: { type: string; key: string },
  ) => {
    if (input.type === "keyDown" && input.key === "F12") {
      event.preventDefault();
      handlers.onToggleDevtools?.();
    }
  };
  guest.on("before-input-event", onBeforeInput);

  emitNavState();

  return () => {
    wv.removeEventListener("did-navigate", onNavigate);
    wv.removeEventListener("did-navigate-in-page", onNavigate);
    wv.removeEventListener("page-title-updated", onTitle);
    wv.removeEventListener("did-stop-loading", onStopLoading);
    guest.removeListener("before-input-event", onBeforeInput);
  };
}

export async function bindDevtoolsHost(
  pageWv: SpiritWebviewTag,
  devtoolsWv: SpiritWebviewTag,
): Promise<void> {
  await waitForWebviewDomReady(pageWv);
  await waitForWebviewDomReady(devtoolsWv);
  const pageWC = pageWv.getWebContents();
  const devtoolsWC = devtoolsWv.getWebContents();
  pageWC.setDevToolsWebContents(devtoolsWC);
}

export async function openEmbeddedDevtools(
  pageWv: SpiritWebviewTag,
  devtoolsWv: SpiritWebviewTag,
): Promise<void> {
  const pageWC = pageWv.getWebContents();
  if (pageWC.isDevToolsOpened()) {
    return;
  }
  // Win32 titleBarOverlay 会强制原生 dock 变 detach（electron/electron#42079），
  // 故用 setDevToolsWebContents 将 DevTools 画进右侧 webview。
  pageWC.openDevTools({ mode: "detach", activate: true });
  try {
    await devtoolsWv.executeJavaScript("window.location.reload()");
  } catch {
    devtoolsWv.reload();
  }
}

export function closeEmbeddedDevtools(pageWv: SpiritWebviewTag): void {
  const pageWC = pageWv.getWebContents();
  if (pageWC.isDevToolsOpened()) {
    pageWC.closeDevTools();
  }
}

export async function captureWebviewPngBase64(
  wv: SpiritWebviewTag,
  rect: WebviewCaptureRect,
): Promise<string> {
  const image = await wv.capturePage(rect);
  const dataUrl = image.toDataURL();
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export async function executeWebviewScript(
  wv: SpiritWebviewTag,
  script: string,
): Promise<unknown> {
  return wv.executeJavaScript(script);
}

export async function insertWebviewCss(wv: SpiritWebviewTag, css: string): Promise<string> {
  return wv.insertCSS(css);
}

export async function removeWebviewCss(wv: SpiritWebviewTag, cssKey: string): Promise<void> {
  await wv.removeInsertedCSS(cssKey);
}

import { BrowserWindow, type WebContents } from 'electron';

export function toggleBrowserWindowFullScreen(host: WebContents): void {
  const window = BrowserWindow.fromWebContents(host);
  if (window && !window.isDestroyed()) {
    window.setFullScreen(!window.isFullScreen());
  }
}

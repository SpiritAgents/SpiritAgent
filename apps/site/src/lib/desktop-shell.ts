/** Current Desktop Electron host platform; `undefined` on Web or when no preload is injected. */
export function desktopShellPlatform(): string | undefined {
  return typeof window !== "undefined" ? window.spiritDesktop?.platform : undefined;
}

export function isNativeTranslucencyPlatform(
  platform: string | undefined,
): platform is "win32" | "darwin" {
  return platform === "win32" || platform === "darwin";
}

/** Whether native window-level translucency materials such as Windows Mica / macOS Vibrancy are available. */
export function isNativeTranslucencySupported(): boolean {
  return isNativeTranslucencyPlatform(desktopShellPlatform());
}

export function isElectronChrome(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (window.spiritDesktop) {
    return true;
  }
  return typeof navigator !== "undefined" && /\bElectron\//.test(navigator.userAgent);
}

/** Aligned with Electron `readTranslucencyFromDisk`; avoids enabling the translucency layer before the first-paint snapshot is ready. */
export function readStoredTranslucency(): boolean {
  if (!isNativeTranslucencySupported()) {
    return false;
  }
  try {
    return window.spiritDesktop?.readTranslucency?.() !== false;
  } catch {
    return true;
  }
}

export function resolveUseTranslucency(translucency: boolean | undefined): boolean {
  if (!isNativeTranslucencySupported()) {
    return false;
  }
  if (translucency === undefined) {
    return readStoredTranslucency();
  }
  return translucency !== false;
}

/** Write Desktop native shell classes before first paint, so the launch layer never uses translucency styles before the snapshot is ready. */
export function applyDesktopNativeChromeToDocument(): void {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  const native = isElectronChrome();
  const translucencyOn = native && readStoredTranslucency();
  root.classList.toggle("spirit-desktop-native", native);
  root.classList.toggle("spirit-desktop-translucency", translucencyOn);
  // Synced with LaunchSplash: hide the main layout under translucency from the first frame to avoid a white flash before useEffect runs.
  root.classList.toggle("spirit-launch-splash-active", translucencyOn);
}

/** Sync the launch-layer class on html when LaunchSplash mounts/unmounts (must match the styles.css rules). */
export function syncLaunchSplashChromeToDocument(phase: "running" | "leaving" | "gone"): void {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  if (phase === "gone") {
    root.classList.remove("spirit-launch-splash-active", "spirit-launch-splash-exiting");
    return;
  }
  root.classList.add("spirit-launch-splash-active");
  root.classList.toggle("spirit-launch-splash-exiting", phase === "leaving");
}

/** Whether the current host is macOS (platform value injected by the Electron preload). */
export function isMacDesktopPlatform(): boolean {
  return desktopShellPlatform() === "darwin";
}

/**
 * Format a shortcut label for the current platform.
 * - macOS: `mod` → `⌘`, joined without separators (e.g. `⌘N`)
 * - Windows / Linux: `mod` → `Ctrl`, joined with `+` (e.g. `Ctrl+N`)
 */
export function shortcutLabel(key: string): string {
  const letter = key.toUpperCase();
  return isMacDesktopPlatform() ? `⌘${letter}` : `Ctrl+${letter}`;
}

/** Physical Ctrl + letter shortcut keys for tooltip Kbd chips (not Cmd on macOS). */
export function ctrlLetterShortcutKbdKeys(key: string): readonly string[] {
  const letter = key.toUpperCase();
  return isMacDesktopPlatform() ? ["⌃", letter] : ["Ctrl", letter];
}

/** Cmd/Ctrl + letter shortcut keys for tooltip Kbd chips. */
export function modLetterShortcutKbdKeys(key: string): readonly string[] {
  const letter = key.toUpperCase();
  return isMacDesktopPlatform() ? ["⌘", letter] : ["Ctrl", letter];
}

/** Alt+Cmd / Ctrl+Alt + letter shortcut keys for tooltip Kbd chips. */
export function modAltLetterShortcutKbdKeys(key: string): readonly string[] {
  const letter = key.toUpperCase();
  return isMacDesktopPlatform() ? ["⌥", "⌘", letter] : ["Ctrl", "Alt", letter];
}

/** Cmd/Ctrl + / shortcut keys for tooltip Kbd chips. */
export function modSlashShortcutKbdKeys(): readonly string[] {
  return isMacDesktopPlatform() ? ["⌘", "/"] : ["Ctrl", "/"];
}

/** Cmd/Ctrl + / shortcut label for the model picker. */
export function modSlashShortcutLabel(): string {
  const keys = modSlashShortcutKbdKeys();
  return isMacDesktopPlatform() ? keys.join("") : keys.join("+");
}

type KeyboardModifierState = Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey">;

/** Whether the platform primary shortcut modifier (⌘ on macOS, Ctrl elsewhere) is held. */
export function isModShortcutPressed(event: KeyboardModifierState): boolean {
  return isMacDesktopPlatform() ? event.metaKey : event.ctrlKey;
}

/** Whether Alt + primary shortcut modifier is held (⌥⌘ on macOS, Ctrl+Alt elsewhere). */
export function isModAltShortcutPressed(event: KeyboardModifierState): boolean {
  if (!event.altKey) {
    return false;
  }
  return isModShortcutPressed(event);
}

/** Windows Electron: uses `titleBarOverlay` + a custom-drawn top bar; macOS keeps the system menu bar */
export function isWin32ElectronShell(): boolean {
  if (!isElectronChrome() || typeof navigator === "undefined") {
    return false;
  }
  return /Windows/i.test(navigator.userAgent);
}

/** macOS Electron: `titleBarStyle: hiddenInset`; requires a reserved safe area for the traffic lights */
export function isDarwinElectronShell(): boolean {
  if (!isElectronChrome()) {
    return false;
  }
  return window.spiritDesktop?.platform === "darwin";
}

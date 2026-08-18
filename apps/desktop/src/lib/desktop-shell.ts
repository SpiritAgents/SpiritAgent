/** Current Desktop Electron host platform; `undefined` on Web or when preload was not injected. */
export function desktopShellPlatform(): NodeJS.Platform | undefined {
  return typeof window !== "undefined" ? window.spiritDesktop?.platform : undefined;
}

export function isNativeTranslucencyPlatform(
  platform: NodeJS.Platform | undefined,
): platform is "win32" | "darwin" {
  return platform === "win32" || platform === "darwin";
}

/** Whether native window-level translucent materials such as Windows Mica / macOS Vibrancy are available. */
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

/** Aligned with Electron's `readTranslucencyFromDisk`; used to avoid wrongly enabling the translucency transparent layer before the first-paint snapshot is ready. */
export function readStoredTranslucency(): boolean {
  if (!isNativeTranslucencySupported()) {
    return false;
  }
  try {
    return window.spiritDesktop?.readTranslucency() !== false;
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

/** Writes the Desktop native shell classes before first paint, so the launch layer never uses translucency transparent styles before the snapshot is ready. */
export function applyDesktopNativeChromeToDocument(): void {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  const native = isElectronChrome();
  const translucencyOn = native && readStoredTranslucency();
  root.classList.toggle("spirit-desktop-native", native);
  root.classList.toggle("spirit-desktop-translucency", translucencyOn);
  // Synced with LaunchSplash: mark the launch layer (including hiding the custom title bar) on the very first frame, so the Menubar is never exposed before useEffect runs.
  root.classList.toggle("spirit-launch-splash-active", native);
}

export type ShellOverlayPhase = "running" | "leaving" | "gone";

/** Syncs the fullscreen overlay (LaunchSplash / OOBE) phase to the html class (called from a single point in App based on both overlay phases; components must not call it themselves, to avoid cleanup races). */
export function syncLaunchSplashChromeToDocument(phase: ShellOverlayPhase): void {
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
 * Formats a shortcut label for the current platform.
 * - macOS: `mod` → `⌘`, joined without a separator (e.g. `⌘N`)
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

/** Cmd/Ctrl + , shortcut keys for tooltip Kbd chips. */
export function modCommaShortcutKbdKeys(): readonly string[] {
  return isMacDesktopPlatform() ? ["⌘", ","] : ["Ctrl", ","];
}

/** Cmd/Ctrl + , shortcut label for opening settings. */
export function settingsShortcutLabel(): string {
  const keys = modCommaShortcutKbdKeys();
  return isMacDesktopPlatform() ? keys.join("") : keys.join("+");
}

/** Cmd/Ctrl + \\ shortcut keys for tooltip Kbd chips. */
export function modBackslashShortcutKbdKeys(): readonly string[] {
  return isMacDesktopPlatform() ? ["⌘", "\\"] : ["Ctrl", "\\"];
}

/** Cmd/Ctrl + Shift + \\ shortcut keys for tooltip Kbd chips. */
export function modShiftBackslashShortcutKbdKeys(): readonly string[] {
  return isMacDesktopPlatform() ? ["⌘", "⇧", "\\"] : ["Ctrl", "Shift", "\\"];
}

/** Cmd/Ctrl + \\ shortcut label for split-right. */
export function modBackslashShortcutLabel(): string {
  const keys = modBackslashShortcutKbdKeys();
  return isMacDesktopPlatform() ? keys.join("") : keys.join("+");
}

/** Cmd/Ctrl + Shift + \\ shortcut label for split-down. */
export function modShiftBackslashShortcutLabel(): string {
  const keys = modShiftBackslashShortcutKbdKeys();
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

/** Windows Electron: uses `titleBarOverlay` + a custom-drawn title bar; macOS keeps the system menu bar */
export function isWin32ElectronShell(): boolean {
  if (!isElectronChrome() || typeof navigator === "undefined") {
    return false;
  }
  return /Windows/i.test(navigator.userAgent);
}

/** macOS Electron: `titleBarStyle: hiddenInset`, so a traffic-light safe area must be reserved */
export function isDarwinElectronShell(): boolean {
  if (!isElectronChrome()) {
    return false;
  }
  return window.spiritDesktop?.platform === "darwin";
}

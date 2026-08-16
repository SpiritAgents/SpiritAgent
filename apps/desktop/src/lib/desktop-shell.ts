/** 当前 Desktop Electron 宿主平台；Web 或未注入 preload 时为 `undefined`。 */
export function desktopShellPlatform(): NodeJS.Platform | undefined {
  return typeof window !== "undefined" ? window.spiritDesktop?.platform : undefined;
}

export function isNativeTranslucencyPlatform(
  platform: NodeJS.Platform | undefined,
): platform is "win32" | "darwin" {
  return platform === "win32" || platform === "darwin";
}

/** Windows Mica / macOS Vibrancy 等原生窗级半透明材质是否可用。 */
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

/** 与 Electron `readTranslucencyFromDisk` 对齐；首屏 snapshot 未就绪时用于避免误开 translucency 透明层。 */
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

/** 首屏前写入 Desktop 原生壳 class，避免启动层在 snapshot 就绪前误用 translucency 透明样式。 */
export function applyDesktopNativeChromeToDocument(): void {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  const native = isElectronChrome();
  const translucencyOn = native && readStoredTranslucency();
  root.classList.toggle("spirit-desktop-native", native);
  root.classList.toggle("spirit-desktop-translucency", translucencyOn);
  // 与 LaunchSplash 同步：首帧即标记启动层（含自绘顶栏隐藏），避免 useEffect 前露出 Menubar。
  root.classList.toggle("spirit-launch-splash-active", native);
}

export type ShellOverlayPhase = "running" | "leaving" | "gone";

/** 同步全屏 overlay（LaunchSplash / OOBE）相位到 html class（由 App 依两 overlay 相位单点调用，组件不得自行调用，避免互相清理踩踏）。 */
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

/** 当前宿主是否为 macOS（Electron preload 注入的平台值）。 */
export function isMacDesktopPlatform(): boolean {
  return desktopShellPlatform() === "darwin";
}

/**
 * 根据当前平台格式化快捷键标签。
 * - macOS: `mod` → `⌘`，拼接无分隔符（如 `⌘N`）
 * - Windows / Linux: `mod` → `Ctrl`，用 `+` 拼接（如 `Ctrl+N`）
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

/** Windows Electron：使用 `titleBarOverlay` + 自绘顶栏；macOS 仍走系统菜单栏 */
export function isWin32ElectronShell(): boolean {
  if (!isElectronChrome() || typeof navigator === "undefined") {
    return false;
  }
  return /Windows/i.test(navigator.userAgent);
}

/** macOS Electron：`titleBarStyle: hiddenInset`，需预留红绿灯安全区 */
export function isDarwinElectronShell(): boolean {
  if (!isElectronChrome()) {
    return false;
  }
  return window.spiritDesktop?.platform === "darwin";
}

export const THEME_STORAGE_KEY = "spirit-agent-desktop-theme" as const;

export type ThemePreference = "system" | "light" | "dark";

const VALID: readonly ThemePreference[] = ["system", "light", "dark"];

function isThemePreference(v: string): v is ThemePreference {
  return (VALID as readonly string[]).includes(v);
}

export function getStoredTheme(): ThemePreference {
  if (typeof localStorage === "undefined") {
    return "system";
  }
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  if (raw && isThemePreference(raw)) {
    return raw;
  }
  return "system";
}

export function setStoredTheme(pref: ThemePreference): void {
  localStorage.setItem(THEME_STORAGE_KEY, pref);
}

export function systemPrefersDark(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  // Electron 里 prefers-color-scheme 跟随 nativeTheme.themeSource：被覆盖为 light/dark
  // 期间 matchMedia 谎报。优先同步读主进程追踪的 OS 真值，切到 system 当帧即可翻转正确的类。
  if (window.spiritDesktop) {
    return window.spiritDesktop.readOsPrefersDark();
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveDark(pref: ThemePreference): boolean {
  if (pref === "dark") {
    return true;
  }
  if (pref === "light") {
    return false;
  }
  return systemPrefersDark();
}

export function desktopNativeThemeForPreference(
  pref: ThemePreference,
): "light" | "dark" | "system" {
  if (pref === "system") {
    return "system";
  }
  if (pref === "dark") {
    return "dark";
  }
  return "light";
}

function setDocumentDark(dark: boolean): void {
  document.documentElement.classList.toggle("dark", dark);
  // data-spirit-theme 由文档级直接维护（原在 app-shell JSX 上）：
  // 避免 App 为此订阅 theme context 导致整棵树随主题切换全量重渲染
  document.documentElement.dataset.spiritTheme = dark ? "dark" : "light";
}

/** 在 `document.documentElement` 上切换 `dark` 类，与 shadcn / tw-animate 的 `.dark` 变体一致。 */
export function applyThemeToDocument(pref: ThemePreference): void {
  if (typeof document === "undefined") {
    return;
  }
  const dark = resolveDark(pref);
  setDocumentDark(dark);
  const nativeTheme = desktopNativeThemeForPreference(pref);
  syncDesktopWindowFrame(dark, nativeTheme, {
    nativeBackdropBlur: document.documentElement.classList.contains("spirit-desktop-mica"),
    // 切回 system 时渲染端 prefers-color-scheme 尚跟随旧覆盖值，resolveDark 可能算错；
    // 主进程在 themeSource 生效后回传真实 dark，在此一次性校正文档，避免等 mq change 二次翻转。
    onDarkCorrected: (realDark) => {
      if (getStoredTheme() !== pref) {
        return;
      }
      setDocumentDark(realDark);
    },
  });
}

/** 与 Tauri `sync_tauri_frame_styling` 对齐：同一 IPC 内先设 `nativeTheme.themeSource` 再刷背景，避免与系统主题错位。 */
export function syncDesktopWindowFrame(
  dark: boolean,
  nativeTheme: "system" | "light" | "dark",
  options?: {
    nativeBackdropBlur?: boolean;
    /** 主进程在 themeSource 生效后回传真实 dark；与本地推算不一致时调用。 */
    onDarkCorrected?: (realDark: boolean) => void;
  },
): void {
  if (typeof window === "undefined" || !window.spiritDesktop) {
    if (
      typeof navigator !== "undefined" &&
      /\bElectron\//.test(navigator.userAgent) &&
      import.meta.env.DEV
    ) {
      console.warn(
        "[spirit-desktop] 无 spiritDesktop 预加载桥，窗口材质 IPC 未发送（检查 preload 与 webPreferences）",
      );
    }
    return;
  }
  void window.spiritDesktop
    .syncWindowFrame({ dark, nativeTheme, nativeBackdropBlur: options?.nativeBackdropBlur })
    .then((realDark) => {
      if (realDark !== dark) {
        options?.onDarkCorrected?.(realDark);
      }
    })
    .catch((err) => {
      console.error("[spirit-desktop] syncWindowFrame IPC 失败:", err);
    });
}

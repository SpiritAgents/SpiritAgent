import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  applyThemeToDocument,
  getStoredTheme,
  setStoredTheme,
  systemPrefersDark,
  type ThemePreference,
} from "@/lib/theme";

export type ThemeContextValue = {
  theme: ThemePreference;
  setTheme: (next: ThemePreference) => void;
  resolvedDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * setTheme 单独一个 context：引用恒定，订阅它的组件不会因 theme 值变化而重渲染。
 * App 顶层只需 setter；theme 值由真正消费它的小组件各自订阅，
 * 避免切主题时整棵 App 树（含 OOBE 期间隐形挂载的 app-body）同步全量重渲染。
 */
const ThemeSetterContext = createContext<((next: ThemePreference) => void) | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => getStoredTheme());
  const [systemDark, setSystemDark] = useState(() => systemPrefersDark());

  const syncSystemDarkFromMain = useCallback((dark: boolean) => {
    setSystemDark(dark);
  }, []);

  const applySystemTheme = useCallback(() => {
    applyThemeToDocument("system", {
      onSystemDarkResolved: syncSystemDarkFromMain,
    });
  }, [syncSystemDarkFromMain]);

  const setTheme = useCallback(
    (next: ThemePreference) => {
      setStoredTheme(next);
      setThemeState(next);
      applyThemeToDocument(next, {
        onSystemDarkResolved: next === "system" ? syncSystemDarkFromMain : undefined,
      });
    },
    [syncSystemDarkFromMain],
  );

  useEffect(() => {
    if (theme !== "system") {
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      setSystemDark(mq.matches);
      applySystemTheme();
    };
    // 同步读可能仍滞后于 themeSource 切换；IPC resolve 会通过 onSystemDarkResolved 校正 resolvedDark。
    setSystemDark(systemPrefersDark());
    applySystemTheme();
    mq.addEventListener("change", onSystemChange);
    return () => {
      mq.removeEventListener("change", onSystemChange);
    };
  }, [applySystemTheme, theme]);

  const resolvedDark =
    theme === "dark" ? true : theme === "light" ? false : systemDark;

  const value = useMemo(
    () => ({ theme, setTheme, resolvedDark }),
    [theme, setTheme, resolvedDark],
  );

  return createElement(
    ThemeSetterContext.Provider,
    { value: setTheme },
    createElement(ThemeContext.Provider, { value }, children),
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return value;
}

/** 仅订阅 setTheme（引用恒定）；组件不会因 theme 值变化而重渲染。 */
export function useThemeSetter(): (next: ThemePreference) => void {
  const setter = useContext(ThemeSetterContext);
  if (!setter) {
    throw new Error("useThemeSetter must be used within ThemeProvider");
  }
  return setter;
}

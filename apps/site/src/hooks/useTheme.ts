/** Preview stub: marketing desktop preview is always dark-themed. */
export type ThemeContextValue = {
  theme: "dark";
  setTheme: (next: "dark" | "light" | "system") => void;
  resolvedDark: boolean;
};

export function useTheme(): ThemeContextValue {
  return {
    theme: "dark",
    setTheme: () => undefined,
    resolvedDark: true,
  };
}

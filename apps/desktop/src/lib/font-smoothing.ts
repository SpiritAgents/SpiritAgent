export const FONT_SMOOTHING_STORAGE_KEY = "spirit-agent-desktop-font-smoothing" as const;

export const FONT_SMOOTHING_CLASS = "spirit-font-smoothing" as const;

export function getStoredFontSmoothing(): boolean {
  if (typeof localStorage === "undefined") {
    return false;
  }
  return localStorage.getItem(FONT_SMOOTHING_STORAGE_KEY) === "true";
}

export function setStoredFontSmoothing(enabled: boolean): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  if (enabled) {
    localStorage.setItem(FONT_SMOOTHING_STORAGE_KEY, "true");
    return;
  }
  localStorage.removeItem(FONT_SMOOTHING_STORAGE_KEY);
}

export function applyFontSmoothingToDocument(enabled: boolean): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.classList.toggle(FONT_SMOOTHING_CLASS, enabled);
}

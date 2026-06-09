export const CLICKABLE_POINTER_CURSOR_STORAGE_KEY =
  "spirit-agent-desktop-clickable-pointer" as const;

export const CLICKABLE_POINTER_CURSOR_CLASS = "spirit-clickable-pointer" as const;

export function getStoredClickablePointerCursor(): boolean {
  if (typeof localStorage === "undefined") {
    return false;
  }
  return localStorage.getItem(CLICKABLE_POINTER_CURSOR_STORAGE_KEY) === "true";
}

export function setStoredClickablePointerCursor(enabled: boolean): void {
  if (enabled) {
    localStorage.setItem(CLICKABLE_POINTER_CURSOR_STORAGE_KEY, "true");
    return;
  }
  localStorage.removeItem(CLICKABLE_POINTER_CURSOR_STORAGE_KEY);
}

export function applyClickablePointerCursorToDocument(enabled: boolean): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.classList.toggle(CLICKABLE_POINTER_CURSOR_CLASS, enabled);
}

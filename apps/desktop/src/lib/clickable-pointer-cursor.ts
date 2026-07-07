export const CLICKABLE_POINTER_CURSOR_STORAGE_KEY =
  "spirit-agent-desktop-clickable-pointer" as const;

export const CLICKABLE_POINTER_CURSOR_CLASS = "spirit-clickable-pointer" as const;

export function getStoredClickablePointerCursor(): boolean {
  if (typeof localStorage === "undefined") {
    return true;
  }
  return localStorage.getItem(CLICKABLE_POINTER_CURSOR_STORAGE_KEY) !== "false";
}

export function setStoredClickablePointerCursor(enabled: boolean): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  if (enabled) {
    localStorage.removeItem(CLICKABLE_POINTER_CURSOR_STORAGE_KEY);
    return;
  }
  localStorage.setItem(CLICKABLE_POINTER_CURSOR_STORAGE_KEY, "false");
}

export function applyClickablePointerCursorToDocument(enabled: boolean): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.classList.toggle(CLICKABLE_POINTER_CURSOR_CLASS, enabled);
}

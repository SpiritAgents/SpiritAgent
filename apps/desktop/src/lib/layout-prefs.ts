import {
  SESSION_SIDEBAR_MIN_WIDTH_PX,
  computeSessionSidebarMaxWidthPx,
} from "@/lib/desktop-chrome";

const SESSION_SIDEBAR_WIDTH_STORAGE_KEY = "spirit-desktop-session-sidebar-width-px";

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function readStoredPositiveInt(
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  try {
    if (typeof localStorage === "undefined") {
      return fallback;
    }
    const raw = localStorage.getItem(key);
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
    if (Number.isFinite(parsed)) {
      return clampInt(parsed, min, max);
    }
  } catch {
    // ignore
  }
  return fallback;
}

function writeStoredPositiveInt(key: string, value: number): void {
  try {
    if (typeof localStorage === "undefined") {
      return;
    }
    localStorage.setItem(key, String(Math.round(value)));
  } catch {
    // ignore
  }
}

export function readSessionSidebarWidthPx(): number {
  const max = computeSessionSidebarMaxWidthPx();
  return readStoredPositiveInt(
    SESSION_SIDEBAR_WIDTH_STORAGE_KEY,
    SESSION_SIDEBAR_MIN_WIDTH_PX,
    SESSION_SIDEBAR_MIN_WIDTH_PX,
    max,
  );
}

export function writeSessionSidebarWidthPx(widthPx: number): void {
  const max = computeSessionSidebarMaxWidthPx();
  writeStoredPositiveInt(
    SESSION_SIDEBAR_WIDTH_STORAGE_KEY,
    clampInt(widthPx, SESSION_SIDEBAR_MIN_WIDTH_PX, max),
  );
}

const WORKSPACE_TOOLS_WIDTH_STORAGE_KEY = "spirit-desktop-workspace-tools-width-px";

export const WORKSPACE_TOOLS_MIN_WIDTH_PX = 240;
export const WORKSPACE_TOOLS_DEFAULT_WIDTH_PX = 420;
const WORKSPACE_TOOLS_VIEWPORT_MAX_WIDTH_RATIO = 0.62;

export function computeWorkspaceToolsMaxWidthPx(
  viewportWidthPx = typeof window !== "undefined" ? window.innerWidth : 1200,
): number {
  return Math.round(viewportWidthPx * WORKSPACE_TOOLS_VIEWPORT_MAX_WIDTH_RATIO);
}

export function readWorkspaceToolsWidthPx(
  viewportWidthPx = typeof window !== "undefined" ? window.innerWidth : 1200,
): number {
  const max = computeWorkspaceToolsMaxWidthPx(viewportWidthPx);
  return readStoredPositiveInt(
    WORKSPACE_TOOLS_WIDTH_STORAGE_KEY,
    WORKSPACE_TOOLS_DEFAULT_WIDTH_PX,
    WORKSPACE_TOOLS_MIN_WIDTH_PX,
    max,
  );
}

export function writeWorkspaceToolsWidthPx(widthPx: number): void {
  const max = computeWorkspaceToolsMaxWidthPx();
  writeStoredPositiveInt(
    WORKSPACE_TOOLS_WIDTH_STORAGE_KEY,
    clampInt(widthPx, WORKSPACE_TOOLS_MIN_WIDTH_PX, max),
  );
}
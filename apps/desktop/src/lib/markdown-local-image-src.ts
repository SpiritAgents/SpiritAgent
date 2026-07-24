import { looksLikeAbsolutePath, normalizeAbsolutePathInput } from "@/lib/file-picker-path";
import { isManagedGeneratedImageRef } from "@/lib/managed-generated-asset";

export type MarkdownImageSrcKind = "managed" | "remote" | "local" | "invalid";

const SCHEME_PATTERN = /^([a-zA-Z][a-zA-Z0-9+.-]*):/u;

/** True for http(s) and protocol-relative URLs that must not load in Markdown media. */
export function isBlockedRemoteMarkdownMediaSrc(src: string): boolean {
  const trimmed = src.trim();
  return trimmed.startsWith("//") || /^https?:/iu.test(trimmed);
}

export function classifyMarkdownImageSrc(src: string): MarkdownImageSrcKind {
  const trimmed = src.trim();
  if (!trimmed) {
    return "invalid";
  }
  if (isManagedGeneratedImageRef(trimmed)) {
    return "managed";
  }
  if (isBlockedRemoteMarkdownMediaSrc(trimmed)) {
    return "remote";
  }
  // Windows drive / UNC paths look like they have a scheme; treat them as local first.
  if (looksLikeAbsolutePath(trimmed)) {
    return "local";
  }
  const schemeMatch = SCHEME_PATTERN.exec(trimmed);
  if (schemeMatch) {
    const scheme = schemeMatch[1]?.toLowerCase() ?? "";
    if (scheme === "http" || scheme === "https") {
      return "remote";
    }
    return "invalid";
  }
  return "local";
}

/**
 * Resolve a Markdown image src to an absolute filesystem path for local IPC preview.
 * Relative paths require baseDir (Markdown file directory or workspace root).
 */
export function resolveMarkdownLocalImageFilePath(
  src: string,
  baseDir?: string,
): string | null {
  const trimmed = src.trim();
  if (!trimmed || classifyMarkdownImageSrc(trimmed) !== "local") {
    return null;
  }

  if (looksLikeAbsolutePath(trimmed)) {
    return normalizeAbsolutePathInput(trimmed);
  }

  const base = baseDir?.trim();
  if (!base) {
    return null;
  }

  return resolveRelativeAgainstBase(base, trimmed);
}

type SplitPath = {
  root: string;
  parts: string[];
  useBackslash: boolean;
};

function splitAbsoluteBase(path: string): SplitPath {
  const useBackslash = /\\/u.test(path);
  const normalized = path.replace(/\\/gu, "/").replace(/\/+$/u, "");
  const windowsDrive = /^([A-Za-z]:)(\/.*)?$/u.exec(normalized);
  if (windowsDrive) {
    const rest = (windowsDrive[2] ?? "").split("/").filter(Boolean);
    return { root: windowsDrive[1] ?? "", parts: rest, useBackslash };
  }
  if (normalized.startsWith("//")) {
    const parts = normalized.split("/").filter(Boolean);
    return { root: "", parts, useBackslash: true };
  }
  if (normalized.startsWith("/")) {
    return {
      root: "",
      parts: normalized.split("/").filter(Boolean),
      useBackslash: false,
    };
  }
  return {
    root: "",
    parts: normalized.split("/").filter(Boolean),
    useBackslash,
  };
}

function joinSplitPath({ root, parts, useBackslash }: SplitPath): string {
  const sep = useBackslash ? "\\" : "/";
  if (root && /^[A-Za-z]:$/u.test(root)) {
    return parts.length > 0 ? `${root}${sep}${parts.join(sep)}` : `${root}${sep}`;
  }
  if (useBackslash && parts.length >= 2 && !root) {
    // UNC-style after normalize: server/share/...
    return `${sep}${sep}${parts.join(sep)}`;
  }
  return `${sep}${parts.join(sep)}`;
}

/** Parent directory of an absolute path (browser-safe; keeps drive / UNC style). */
export function dirnameLocalPath(absolutePath: string): string {
  const trimmed = absolutePath.trim();
  if (!trimmed) {
    return "";
  }
  const useBackslash = /\\/u.test(trimmed);
  const normalized = trimmed.replace(/\\/gu, "/").replace(/\/+$/u, "");
  const windowsDriveOnly = /^[A-Za-z]:$/u.exec(normalized);
  if (windowsDriveOnly) {
    return useBackslash ? `${normalized}\\` : `${normalized}/`;
  }
  const slash = normalized.lastIndexOf("/");
  if (slash === 0) {
    return "/";
  }
  if (slash < 0) {
    return useBackslash ? normalized.replace(/\//gu, "\\") : normalized || "/";
  }
  const dir = normalized.slice(0, slash);
  if (/^[A-Za-z]:$/u.test(dir)) {
    return useBackslash ? `${dir}\\` : `${dir}/`;
  }
  return useBackslash ? dir.replace(/\//gu, "\\") : dir || "/";
}

function resolveRelativeAgainstBase(baseDir: string, relativePath: string): string {
  const base = splitAbsoluteBase(baseDir);
  const relativeSegments = relativePath
    .replace(/\\/gu, "/")
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== ".");

  const parts = [...base.parts];
  for (const segment of relativeSegments) {
    if (segment === "..") {
      if (parts.length > 0) {
        parts.pop();
      }
      continue;
    }
    parts.push(segment);
  }

  return joinSplitPath({ ...base, parts });
}

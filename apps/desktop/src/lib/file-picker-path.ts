/** Windows drive letter (`C:\`) or UNC (`\\server\share`). */
const WINDOWS_ABSOLUTE_PATTERN = /^(?:[A-Za-z]:[\\/]|\\\\)/u;

/** Unix absolute path (`/home/...`). */
const UNIX_ABSOLUTE_PATTERN = /^\//u;

export function looksLikeAbsolutePath(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) {
    return false;
  }
  return WINDOWS_ABSOLUTE_PATTERN.test(trimmed) || UNIX_ABSOLUTE_PATTERN.test(trimmed);
}

export function normalizeAbsolutePathInput(input: string): string {
  return input.trim();
}

export function workspaceFileBasename(relativePath: string): string {
  const segments = relativePath.split('/');
  return segments[segments.length - 1] || relativePath;
}

export function isMarkdownPath(path: string): boolean {
  return /\.(md|mdx|markdown|mdown|mkd|mkdn|mdwn)$/i.test(path);
}

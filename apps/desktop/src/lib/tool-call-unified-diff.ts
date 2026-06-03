import { createTwoFilesPatch } from 'diff';

/** 由 original/modified 生成 react-diff-view 可消费的 unified diff 文本。 */
function normalizeDiffPath(relativePath: string): string {
  return relativePath.replace(/\\/gu, '/').trim() || 'file';
}

export function buildToolCallUnifiedDiff(
  relativePath: string,
  original: string,
  modified: string,
): string {
  const path = normalizeDiffPath(relativePath);
  const body = createTwoFilesPatch(path, path, original, modified, '', '', { context: 3 });
  return `diff --git a/${path} b/${path}\n${body}`;
}

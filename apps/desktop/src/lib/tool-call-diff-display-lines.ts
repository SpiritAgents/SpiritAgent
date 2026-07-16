import type { DiffDisplayLine } from '@/lib/diff-display-lines';

/** 工具卡 diff 展示行：非 followTail 同步 lines；followTail 在空→有内容时同帧显示，其余走 debounced。 */
export function resolveToolCallDisplayLines(
  lines: DiffDisplayLine[],
  debouncedLines: DiffDisplayLine[],
  followTail: boolean,
): DiffDisplayLine[] {
  if (!followTail) {
    return lines;
  }
  if (lines.length === 0) {
    return [];
  }
  return debouncedLines.length === 0 ? lines : debouncedLines;
}

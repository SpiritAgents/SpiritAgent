import { resolvePathFromFileDiffToolSnapshot } from '@/lib/file-tool-diff-source';
import { resolveReadFileEditorTarget } from '@/lib/read-file-tool-navigation';
import type { EditorFileTarget } from '@/lib/workspace-editor-navigation';
import type { ToolBlockSnapshot } from '@/types';

const FILE_DIFF_OPEN_TOOL_NAMES = new Set(['create_file', 'edit_file']);

/** 从 create_file / edit_file 工具快照解析编辑器打开目标。 */
export function resolveFileDiffToolEditorTarget(
  tool: Pick<
    ToolBlockSnapshot,
    | 'toolName'
    | 'argsExcerpt'
    | 'phase'
    | 'streamingArgumentsJson'
    | 'fileToolDiffArgumentsJson'
  >,
  workspaceRoot: string,
): EditorFileTarget | null {
  if (!FILE_DIFF_OPEN_TOOL_NAMES.has(tool.toolName)) {
    return null;
  }
  const rawPath = resolvePathFromFileDiffToolSnapshot(tool as ToolBlockSnapshot);
  if (!rawPath?.trim()) {
    return null;
  }
  return resolveReadFileEditorTarget(rawPath, workspaceRoot);
}

import { workspaceFileBasename } from '@/lib/file-picker-path';
import { appendWorkspaceExplorerIconSvg } from '@/lib/workspace-explorer-icon-dom';

/** 工作区 @file 引用 chip，尺寸与元素 chip 对齐 */
export const WORKSPACE_FILE_CHIP_CLASS =
  "inline-flex items-center gap-1 rounded-md border border-emerald-200/90 bg-emerald-50 px-1.5 py-0.5 text-xs font-medium leading-none text-emerald-900 select-none align-middle mx-0.5 dark:border-emerald-700/60 dark:bg-emerald-950 dark:text-emerald-300";

export const WORKSPACE_FILE_CHIP_ICON_CLASS = "text-emerald-600 dark:text-emerald-400";

export function makeFileChipNode(path: string, doc: Document): HTMLElement {
  const normalized = path.replace(/\\/gu, "/");
  const span = doc.createElement("span");
  span.contentEditable = "false";
  span.dataset.fileChip = "true";
  span.dataset.filePath = normalized;
  span.setAttribute("data-file-chip", "true");
  span.setAttribute("data-file-path", normalized);
  span.className = WORKSPACE_FILE_CHIP_CLASS;
  span.title = normalized;

  appendWorkspaceExplorerIconSvg(span, doc, normalized, {
    size: 10,
    className: WORKSPACE_FILE_CHIP_ICON_CLASS,
  });

  span.appendChild(doc.createTextNode(workspaceFileBasename(normalized)));
  return span;
}

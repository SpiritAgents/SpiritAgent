import {
  isWorkspaceReferenceDirectoryPath,
  normalizeWorkspaceReferenceDirectoryPath,
} from '@spirit-agent/host-internal/workspace-file-reference-query';
import { workspaceFileBasename } from '@/lib/file-picker-path';
import {
  COMPOSER_INLINE_CHIP_CLASS,
  COMPOSER_INLINE_CHIP_ICON_CLASS,
} from '@/lib/composer-inline-chip-styles';
import { PLAN_CHIP_CLASS, PLAN_CHIP_ICON_CLASS } from '@/lib/plan-chip-styles';
import { appendWorkspaceExplorerIconSvg } from '@/lib/workspace-explorer-icon-dom';
import type { WorkspaceExplorerEntryKind } from '@/types';

/** 工作区 @file 引用 chip（文件路径；目录 chip 仍走 Plan 样式） */
export const WORKSPACE_FILE_CHIP_CLASS = COMPOSER_INLINE_CHIP_CLASS;

export const WORKSPACE_FILE_CHIP_ICON_CLASS = COMPOSER_INLINE_CHIP_ICON_CLASS;

export function isWorkspaceDirectoryChipPath(path: string): boolean {
  return isWorkspaceReferenceDirectoryPath(path.replace(/\\/gu, '/'));
}

export function resolveWorkspaceFileChipPresentation(path: string): {
  chipClass: string;
  iconClass: string;
  iconKind: WorkspaceExplorerEntryKind;
  iconPath: string;
} {
  const normalized = path.replace(/\\/gu, '/');
  if (isWorkspaceDirectoryChipPath(normalized)) {
    return {
      chipClass: PLAN_CHIP_CLASS,
      iconClass: PLAN_CHIP_ICON_CLASS,
      iconKind: 'dir',
      iconPath: normalizeWorkspaceReferenceDirectoryPath(normalized),
    };
  }

  return {
    chipClass: WORKSPACE_FILE_CHIP_CLASS,
    iconClass: WORKSPACE_FILE_CHIP_ICON_CLASS,
    iconKind: 'file',
    iconPath: normalized,
  };
}

export function makeFileChipNode(path: string, doc: Document): HTMLElement {
  const normalized = path.replace(/\\/gu, "/");
  const presentation = resolveWorkspaceFileChipPresentation(normalized);
  const span = doc.createElement("span");
  span.contentEditable = "false";
  span.dataset.fileChip = "true";
  span.dataset.filePath = normalized;
  span.setAttribute("data-file-chip", "true");
  span.setAttribute("data-file-path", normalized);
  span.className = presentation.chipClass;
  span.title = normalized;

  appendWorkspaceExplorerIconSvg(span, doc, presentation.iconPath, {
    size: 10,
    className: presentation.iconClass,
  }, presentation.iconKind);

  span.appendChild(doc.createTextNode(workspaceFileBasename(normalized)));
  return span;
}

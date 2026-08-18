import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Folder } from "lucide-react";

import { cn } from "@/lib/utils";
import type { WorkspaceFileIconColorMode } from "@/lib/workspace-file-icon-sizes";

/** Matches the Lucide icons in the slash / @ dropdowns (see skill-slash-menu). */
export const WORKSPACE_DIRECTORY_LIST_ICON_CLASS = "size-3.5 shrink-0 opacity-70";

/** Chip inherit directory icon, consistent with main and other composer chips (10px). */
export const WORKSPACE_DIRECTORY_CHIP_ICON_CLASS = "size-[10px] shrink-0";

export function workspaceDirectoryIconClassName(
  colorMode: WorkspaceFileIconColorMode,
  className?: string,
): string {
  if (colorMode === "inherit") {
    return cn(WORKSPACE_DIRECTORY_CHIP_ICON_CLASS, className);
  }
  return cn(WORKSPACE_DIRECTORY_LIST_ICON_CLASS, className);
}

export function renderWorkspaceDirectoryIconMarkup(
  className: string,
  colorMode: WorkspaceFileIconColorMode,
): string {
  return renderToStaticMarkup(
    createElement(Folder, {
      className: workspaceDirectoryIconClassName(colorMode, className),
      "aria-hidden": true,
    }),
  ).trim();
}

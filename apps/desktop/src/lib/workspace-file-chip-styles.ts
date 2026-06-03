/** 工作区 @file 引用 chip，尺寸与元素 chip 对齐 */
export const WORKSPACE_FILE_CHIP_CLASS =
  "inline-flex items-center gap-1 rounded-md border border-emerald-200/90 bg-emerald-50 px-1.5 py-0.5 text-xs font-medium leading-none text-emerald-900 select-none align-middle mx-0.5 dark:border-emerald-700/60 dark:bg-emerald-950 dark:text-emerald-300";

export const WORKSPACE_FILE_CHIP_ICON_CLASS = "text-emerald-600 dark:text-emerald-400";

export function workspaceFileBasename(path: string): string {
  const normalized = path.replace(/\\/gu, "/");
  const segments = normalized.split("/");
  return segments[segments.length - 1] || normalized;
}

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

  const icon = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("width", "10");
  icon.setAttribute("height", "10");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("class", WORKSPACE_FILE_CHIP_ICON_CLASS);
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML =
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>';

  span.appendChild(icon);
  span.appendChild(doc.createTextNode(workspaceFileBasename(normalized)));
  return span;
}

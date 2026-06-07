import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { WorkspaceExplorerEntryKind } from '@/types';

import { workspaceExplorerIconForPath } from '@/lib/workspace-explorer-icon';

/** contenteditable chip：与 React 列表共用 Lucide 组件，经 renderToStaticMarkup 写入 DOM。 */
export function appendWorkspaceExplorerIconSvg(
  parent: HTMLElement,
  doc: Document,
  path: string,
  attrs: { size: number; className: string },
  kind: WorkspaceExplorerEntryKind = 'file',
): void {
  const Icon = workspaceExplorerIconForPath(path, kind);
  const markup = renderToStaticMarkup(
    createElement(Icon, {
      size: attrs.size,
      className: attrs.className,
      'aria-hidden': true,
    }),
  );
  const template = doc.createElement('template');
  template.innerHTML = markup.trim();
  const svg = template.content.firstElementChild;
  if (svg) {
    parent.appendChild(doc.importNode(svg, true));
  }
}

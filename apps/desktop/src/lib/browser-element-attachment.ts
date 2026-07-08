const OUTER_HTML_MAX_BYTES = 4096;

export interface BrowserElementAttachment {
  id: string;
  tagName: string;
  outerHtml: string;
  screenshotDataUrl: string;
  pageUrl: string;
}

export function truncateOuterHtml(html: string): string {
  if (html.length <= OUTER_HTML_MAX_BYTES) return html;
  // 按码点截断避免切开代理对；先按 code unit 取 2 倍上限前缀再展开，
  // 防止对超大 outerHTML 整串展开（前 N 个码点必然落在前 2N 个 code unit 内）。
  const points = [...html.slice(0, OUTER_HTML_MAX_BYTES * 2)];
  return points.slice(0, OUTER_HTML_MAX_BYTES).join('') + '…';
}

export { browserElementContextText } from "./browser-element-wire-text.js";

export type BrowserElementAttachment = {
  id: string;
  tagName: string;
  url: string;
  pageUrl?: string;
  outerHtml?: string;
  screenshotDataUrl?: string;
};

export function truncateOuterHtml(html: string, maxBytes = 4096): string {
  const encoder = new TextEncoder();
  if (encoder.encode(html).length <= maxBytes) {
    return html;
  }
  let low = 0;
  let high = html.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (encoder.encode(html.slice(0, mid)).length <= maxBytes) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return html.slice(0, low);
}

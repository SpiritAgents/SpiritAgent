/** 使 Seti SVG 继承容器 `color`（currentColor），便于 React class 与 inline style 着色。 */
export function normalizeSetiSvgForCurrentColor(svg: string): string {
  if (svg.includes('fill=')) {
    return svg.replace(/\sfill="[^"]*"/gu, ' fill="currentColor"');
  }
  return svg.replace(/<path\b/gu, '<path fill="currentColor"');
}

export function injectSetiSvgDimensions(svg: string, size: number): string {
  return svg.replace(/^<svg\b/u, `<svg width="${size}" height="${size}"`);
}

/** 列表 / 下拉：Seti 字形留白较多，18px 对齐 Lucide `size-3.5` 视觉重量。 */
export const WORKSPACE_FILE_ICON_LIST_SIZE_PX = 18;

/** Composer chip 内联图标（原 Lucide 10px）。 */
export const WORKSPACE_FILE_ICON_CHIP_SIZE_PX = 12;

export function prepareSetiSvgForDisplay(svg: string, size: number): string {
  return injectSetiSvgDimensions(svg, size);
}

export function resolveDomSetiIconTheme(): 'dark' | 'light' {
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
    return 'dark';
  }
  return 'light';
}

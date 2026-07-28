import type { CSSProperties } from "react";

/** 视口坐标系下的遮挡形状（mask 中 black = 不绘制消息） */
export type ConversationScrollOccludeShape = {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 统一圆角（胶囊 / 四角圆角矩形） */
  rx: number;
  ry: number;
  /** 仅上圆角（TODO 贴输入框）；下沿直角，避免误裁底角或漏裁方角 */
  roundTopOnly?: boolean;
};

export type ConversationScrollOccludeMaskInput = {
  viewportWidth: number;
  viewportHeight: number;
  shapes: readonly ConversationScrollOccludeShape[];
  /**
   * 自该 Y（视口坐标）起铺满视口宽的底带：封住输入框底圆角外侧空隙 + 审批栏。
   * 输入框顶圆角外侧不在此带内，消息仍可从空隙露出。
   */
  bottomSlabFromY?: number;
};

function clampShape(
  shape: ConversationScrollOccludeShape,
  vw: number,
  vh: number,
): ConversationScrollOccludeShape | null {
  const x = Math.max(0, shape.x);
  const y = Math.max(0, shape.y);
  const right = Math.min(vw, shape.x + shape.width);
  const bottom = Math.min(vh, shape.y + shape.height);
  const width = right - x;
  const height = bottom - y;
  if (width <= 0.5 || height <= 0.5) {
    return null;
  }
  // 统一上限为 min(w,h)/2：rounded-full 的超大 radius 若分别按 w/2、h/2 clamp，
  // 会变成椭圆（rx≠ry），胶囊四角落在 mask 外 → 内部透字。
  const maxR = Math.min(width, height) / 2;
  return {
    x,
    y,
    width,
    height,
    rx: Math.min(Math.max(0, shape.rx), maxR),
    ry: Math.min(Math.max(0, shape.ry), maxR),
    roundTopOnly: shape.roundTopOnly,
  };
}

/** 从视口与元素矩形得到相对坐标形状 */
export function conversationScrollOccludeShapeFromRects(
  viewportRect: DOMRectReadOnly,
  elementRect: DOMRectReadOnly,
  rx: number,
  ry: number,
  options?: { roundTopOnly?: boolean },
): ConversationScrollOccludeShape {
  return {
    x: elementRect.left - viewportRect.left,
    y: elementRect.top - viewportRect.top,
    width: elementRect.width,
    height: elementRect.height,
    rx,
    ry,
    ...(options?.roundTopOnly ? { roundTopOnly: true } : {}),
  };
}

export function readElementUniformBorderRadius(element: HTMLElement): number {
  const style = getComputedStyle(element);
  return Math.max(
    0,
    Number.parseFloat(style.borderTopLeftRadius) || 0,
    Number.parseFloat(style.borderTopRightRadius) || 0,
    Number.parseFloat(style.borderBottomRightRadius) || 0,
    Number.parseFloat(style.borderBottomLeftRadius) || 0,
  );
}

/** 仅取顶角半径（TODO：上圆下直） */
export function readElementTopBorderRadius(element: HTMLElement): number {
  const style = getComputedStyle(element);
  return Math.max(
    0,
    Number.parseFloat(style.borderTopLeftRadius) || 0,
    Number.parseFloat(style.borderTopRightRadius) || 0,
  );
}

function shapeToSvg(shape: ConversationScrollOccludeShape): string {
  const x = shape.x.toFixed(2);
  const y = shape.y.toFixed(2);
  const w = shape.width.toFixed(2);
  const h = shape.height.toFixed(2);
  if (shape.roundTopOnly) {
    const r = Math.min(shape.rx, shape.ry, shape.width / 2, shape.height);
    if (r <= 0.5) {
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="black"/>`;
    }
    const rStr = r.toFixed(2);
    const x2 = (shape.x + shape.width).toFixed(2);
    const y2 = (shape.y + shape.height).toFixed(2);
    const xR = (shape.x + r).toFixed(2);
    const xWR = (shape.x + shape.width - r).toFixed(2);
    const yR = (shape.y + r).toFixed(2);
    // 上圆角、下直角
    return `<path d="M${x},${yR} A${rStr},${rStr} 0 0 1 ${xR},${y} H${xWR} A${rStr},${rStr} 0 0 1 ${x2},${yR} V${y2} H${x} Z" fill="black"/>`;
  }
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${shape.rx.toFixed(2)}" ry="${shape.ry.toFixed(2)}" fill="black"/>`;
}

/**
 * 构建会话滚动视口 mask：白=绘制消息，黑=不绘制。
 * 形状仅裁切自身轮廓（Changes/TODO/输入框顶圆角空隙不裁）；底带封底圆角外侧与审批栏。
 */
export function buildConversationScrollOccludeMaskStyle(
  input: ConversationScrollOccludeMaskInput,
): CSSProperties | undefined {
  const vw = Math.ceil(input.viewportWidth);
  const vh = Math.ceil(input.viewportHeight);
  if (vw <= 0 || vh <= 0) {
    return undefined;
  }

  const shapes = input.shapes
    .map((shape) => clampShape(shape, vw, vh))
    .filter((shape): shape is ConversationScrollOccludeShape => shape != null);

  const bottomSlabFromY =
    input.bottomSlabFromY == null
      ? null
      : Math.min(vh, Math.max(0, input.bottomSlabFromY));

  if (shapes.length === 0 && bottomSlabFromY == null) {
    return undefined;
  }

  const shapeMarkup = shapes.map(shapeToSvg).join("");
  const bottomSlab =
    bottomSlabFromY == null || bottomSlabFromY >= vh
      ? ""
      : `<rect x="0" y="${bottomSlabFromY.toFixed(2)}" width="${vw}" height="${(vh - bottomSlabFromY).toFixed(2)}" fill="black"/>`;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}">` +
    `<rect width="100%" height="100%" fill="white"/>` +
    shapeMarkup +
    bottomSlab +
    `</svg>`;

  const maskImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  // data-URL SVG 默认按 alpha 采样：黑/白 fill 都是不透明 → 裁切完全无效；须用 luminance（白=显、黑=隐）
  return {
    maskImage,
    WebkitMaskImage: maskImage,
    maskMode: "luminance",
    WebkitMaskSourceType: "luminance",
    maskSize: "100% 100%",
    WebkitMaskSize: "100% 100%",
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
  } as CSSProperties;
}

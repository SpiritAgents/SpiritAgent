import type { CSSProperties, ReactElement, SVGProps } from "react";

export const SPIRIT_GLASS_LOGO_PATH: string;
export const SPIRIT_GLASS_LOGO_VIEWBOX: { width: 142; height: 157 };

/** 供启动层 shimmer 蒙版：与玻璃标轮廓一致 */
export function spiritGlassLogoMaskStyle(): CSSProperties;

export type SpiritGlassLogoProps = Omit<SVGProps<SVGSVGElement>, "width" | "height" | "viewBox"> & {
  /** 渲染宽度（px）；高度按 viewBox 比例推算 */
  width?: number;
};

export function SpiritGlassLogo(props: SpiritGlassLogoProps): ReactElement;

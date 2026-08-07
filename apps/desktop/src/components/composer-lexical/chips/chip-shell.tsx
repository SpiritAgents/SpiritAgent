import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ChipShellProps = {
  className?: string;
  title?: string;
  "aria-label"?: string;
  "data-chip-kind"?: string;
  "data-element-chip"?: string;
  "data-element-id"?: string;
  "data-element-tag"?: string;
  "data-element-html"?: string;
  "data-element-url"?: string;
  children: ReactNode;
};

// chip 子树不得带 user-select: none——它会抑制整棵子树的原生选区绘制（文字与图标都无选区底色）
export function ChipShell({
  className,
  title,
  "aria-label": ariaLabel,
  "data-chip-kind": chipKind,
  "data-element-chip": elementChip,
  "data-element-id": elementId,
  "data-element-tag": elementTag,
  "data-element-html": elementHtml,
  "data-element-url": elementUrl,
  children,
}: ChipShellProps) {
  return (
    <span
      contentEditable={false}
      data-spirit-chip="true"
      data-chip-kind={chipKind}
      data-element-chip={elementChip}
      data-element-id={elementId}
      data-element-tag={elementTag}
      data-element-html={elementHtml}
      data-element-url={elementUrl}
      className={className}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
      <ChipTrailingSpacer />
    </span>
  );
}

/** 无图标 chip（如 skill）专用：覆盖左 margin + 左 padding 的选区带。带图标的 chip 由 ChipIcon spacer 负责，不可叠加（会下移图标基线）。 */
export function ChipLeadingSpacer() {
  return (
    <span
      aria-hidden="true"
      data-chip-leading-spacer="true"
      className="text-transparent"
      style={{
        lineHeight: 0,
        letterSpacing: "calc(var(--chip-pad, 0px) + var(--chip-mx, 0px) - 1em)",
        marginLeft: "calc(-1 * (var(--chip-pad, 0px) + var(--chip-mx, 0px)))",
      }}
    >
      {CHIP_ICON_SPACER_GLYPH}
    </span>
  );
}

// U+3000 表意空格：advance 恒为 1em 的空白字形，用作 chip 选区底色的「隐形文本」
const CHIP_ICON_SPACER_GLYPH = String.fromCodePoint(0x3000);

/**
 * 尾部隐形文本 run：label 的选区底色不会右延覆盖 chip 的右 padding 与 margin
 * （实测 Chromium 只把行带画到文本 advance 末端，邻 run 也不会延伸覆盖 margin，
 * 见 verify-chip-selection.mjs 缝隙扫描），pill 型 chip（px-1.5）右端会露出
 * padding+margin 宽度的未选中缺口。用一个透明 U+3000 把选区底色恰好推满
 * 右 padding + 右 margin：advance = --chip-pad + --chip-mx（1em + 负 letter-spacing
 * 凑出），margin-right 负值收回自身宽度，chip 总宽不变。
 * 注意 advance 必须恰好止于 chipRight + --chip-mx（= 邻文本 advance 起点，两侧带缘
 * 重合无缝）；探过头会与邻带半透明叠涂出更深的接缝（实测叠涂区 (149,199,255) vs
 * 正常 (180,215,254)）
 */
function ChipTrailingSpacer() {
  return (
    <span
      aria-hidden="true"
      data-chip-trailing-spacer="true"
      className="text-transparent"
      style={{
        lineHeight: 0,
        letterSpacing: "calc(var(--chip-pad, 0px) - 1em + var(--chip-mx, 0px))",
        marginRight: "calc(-1 * (var(--chip-pad, 0px) + var(--chip-mx, 0px)))",
      }}
    >
      {CHIP_ICON_SPACER_GLYPH}
    </span>
  );
}

/**
 * Chip 内联图标的统一包裹层。
 *
 * Chromium 不给 inline SVG 画选区背景（svgwg#894 规范未定）；透明 <img> 的 replaced
 * tint 实测是半透明叠加且画在图标之上（选中后图标发灰），高度也只能对齐自身盒子而非
 * 文字行带。因此改为「隐形文本」方案：图标前放一个透明表意空格文本 run——
 * 选区底色由浏览器按普通文本行带绘制，颜色/高度/垂直位置与同行 plain text 天然一致
 * （同一绘制路径），图标 svg 画在底色之上保持锐利。
 *
 * - spacer 宽度 = 左 margin（--chip-mx）+ 左 padding（--chip-pad）+ 图标槽（1em）+ 图标与
 *   label 间距（4px）：U+3000 advance 恒为 1em，超出部分用 letter-spacing 补足；不要用
 *   font-size 撑宽——实测选区底色 = 行带 ∪ 文本 run 自身字体盒，font-size 放大会让底色
 *   上缘探出行带；line-height: 0 把 spacer 的行内盒高度归零，彻底排除该影响
 * - 无图标 chip 的左 margin/padding 由 ChipLeadingSpacer 单独覆盖（不可与 ChipIcon 叠加）
 * - slot 用负 margin 回叠到 spacer 的图标区上方，margin-right 提供与 label 的 4px 间距；
 *   verticalAlign 负值在 Chromium 内联布局中会下移元素（实测 -2.5px 导致图标下垂 1.75css），
 *   校准值为 -0.75px 使 slot 与 label 垂直中心重合
 * - chip 右 padding 的选区底色由 ChipShell 末尾的 ChipTrailingSpacer 负责
 */

export function ChipIcon({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <>
      <span
        aria-hidden="true"
        data-chip-icon-spacer="true"
        className="text-transparent"
        style={{
          lineHeight: 0,
          letterSpacing: "calc(var(--chip-pad, 0px) + var(--chip-mx, 0px) + 4px)",
          marginLeft: "calc(-1 * (var(--chip-pad, 0px) + var(--chip-mx, 0px)))",
        }}
      >
        {CHIP_ICON_SPACER_GLYPH}
      </span>
      <span
        data-chip-icon-slot="true"
        className={cn(
          "relative inline-flex h-[1em] w-[1em] shrink-0 items-center justify-center",
          className,
        )}
        style={{ marginLeft: "calc(-1em - 4px)", marginRight: "4px", verticalAlign: "-0.75px" }}
      >
        {children}
      </span>
    </>
  );
}

export function ChipIconSvg({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <ChipIcon className={className}>
      <svg
        viewBox="0 0 24 24"
        width={10}
        height={10}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {children}
      </svg>
    </ChipIcon>
  );
}

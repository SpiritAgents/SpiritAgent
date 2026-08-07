import { FONT_WEIGHT_NORMAL } from "@/lib/desktop-typography";

// 无图标 chip：左 padding 没有选区底色来源（native 不给元素 padding 画选区），去掉让文本
// 选区从 chip 左缘开始；右 padding 由文本选区右延覆盖（见 chip-shell.tsx）
// 必须为 inline（非 inline-flex）：label 文本才能并入外层行盒，选区带与 plain text 同高同色
// --chip-pad 须等于根 px、--chip-mx 须等于根 mx：供首尾 spacer 伸出覆盖 padding 与
// margin 的选区带（见 chip-shell.tsx）
export const SKILL_CHIP_CLASS = `inline whitespace-nowrap px-0.5 py-0.5 text-xs ${FONT_WEIGHT_NORMAL} leading-none text-yellow-600 mx-0.5 [--chip-pad:2px] [--chip-mx:2px] dark:text-amber-400`;

export function makeSkillChipNode(alias: string, doc: Document): HTMLElement {
  const span = doc.createElement("span");
  span.contentEditable = "false";
  span.setAttribute("data-skill-chip", "true");
  span.dataset.skillChip = "true";
  span.dataset.skillAlias = alias;
  span.setAttribute("data-skill-alias", alias);
  span.className = SKILL_CHIP_CLASS;
  span.setAttribute("aria-label", alias);

  span.appendChild(doc.createTextNode(alias));
  return span;
}

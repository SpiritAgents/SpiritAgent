import { FONT_WEIGHT_NORMAL } from "@/lib/desktop-typography";

// 半透明底色：与 Composer 磨砂 surface 混叠，避免 opaque 色块与底色调不齐
export const LOOP_CHIP_CLASS =
  `inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-xs ${FONT_WEIGHT_NORMAL} leading-none text-indigo-700 select-none align-middle mx-0.5 dark:bg-indigo-500/15 dark:text-indigo-400`;

export function makeLoopChipNode(doc: Document, label = "Loop"): HTMLElement {
  const span = doc.createElement("span");
  span.contentEditable = "false";
  span.setAttribute("data-loop-chip", "true");
  span.dataset.loopChip = "true";
  span.className = LOOP_CHIP_CLASS;
  span.setAttribute("aria-label", label);

  const icon = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("width", "10");
  icon.setAttribute("height", "10");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML =
    '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>';

  span.appendChild(icon);
  span.appendChild(doc.createTextNode(label));
  return span;
}

import { FONT_WEIGHT_NORMAL } from "@/lib/desktop-typography";

// 半透明底色：与 Composer 磨砂 surface 混叠，避免 opaque 色块与底色调不齐
export const ASK_CHIP_CLASS =
  `inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-xs ${FONT_WEIGHT_NORMAL} leading-none text-emerald-900 select-none align-middle mx-0.5 dark:bg-emerald-500/15 dark:text-emerald-500`;

export function makeAskChipNode(doc: Document, label = "Ask"): HTMLElement {
  const span = doc.createElement("span");
  span.contentEditable = "false";
  span.setAttribute("data-ask-chip", "true");
  span.dataset.askChip = "true";
  span.className = ASK_CHIP_CLASS;
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
    '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>';

  span.appendChild(icon);
  span.appendChild(doc.createTextNode(label));
  return span;
}

export const SKILL_CHIP_CLASS =
  "inline-flex items-center gap-1 rounded-md border border-yellow-200/90 bg-yellow-50 px-1.5 py-0.5 text-xs font-medium leading-none text-yellow-900 select-none align-middle mx-0.5 dark:border-yellow-700/60 dark:bg-yellow-950 dark:text-yellow-300";

export const SKILL_CHIP_ICON_CLASS = "text-yellow-600 dark:text-yellow-400";

export function makeSkillChipNode(alias: string, doc: Document): HTMLElement {
  const span = doc.createElement("span");
  span.contentEditable = "false";
  span.setAttribute("data-skill-chip", "true");
  span.dataset.skillChip = "true";
  span.dataset.skillAlias = alias;
  span.setAttribute("data-skill-alias", alias);
  span.className = SKILL_CHIP_CLASS;
  span.setAttribute("aria-label", alias);

  const icon = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("width", "10");
  icon.setAttribute("height", "10");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("class", SKILL_CHIP_ICON_CLASS);
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML =
    '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>';

  span.appendChild(icon);
  span.appendChild(doc.createTextNode(alias));
  return span;
}

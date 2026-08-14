export type BrowserPickerTarget = "headline" | "tagline" | "cta";

export type DesignModeDemoState = {
  pickerActive: boolean;
  hoverTarget: BrowserPickerTarget | null;
  selectedTarget: BrowserPickerTarget | null;
  headlineVariant: "original" | "improved";
  showCursor: boolean;
  cursorTransitionMs: number;
};

export const INITIAL_DESIGN_MODE_DEMO_STATE: DesignModeDemoState = {
  pickerActive: false,
  hoverTarget: null,
  selectedTarget: null,
  headlineVariant: "original",
  showCursor: false,
  cursorTransitionMs: 500,
};

export type BrowserTargetRects = Partial<Record<BrowserPickerTarget, DOMRect>>;

const BROWSER_PICKER_TARGET_ATTR = "data-design-target";

export function hitTestBrowserPickerTargetFromPoint(
  clientX: number,
  clientY: number,
  container: HTMLElement,
): BrowserPickerTarget | null {
  const elements = document.elementsFromPoint(clientX, clientY);
  for (const element of elements) {
    if (!(element instanceof HTMLElement) || !container.contains(element)) {
      continue;
    }
    const marked = element.closest(`[${BROWSER_PICKER_TARGET_ATTR}]`);
    if (!(marked instanceof HTMLElement) || !container.contains(marked)) {
      continue;
    }
    const target = marked.getAttribute(BROWSER_PICKER_TARGET_ATTR);
    if (target === "headline" || target === "tagline" || target === "cta") {
      return target;
    }
  }
  return null;
}

import { useLayoutEffect, type RefObject } from "react";

import { scrollIntoViewportWithPadding } from "@/lib/scroll-area-viewport";

type ComposerSuggestionItemDataAttribute =
  | "data-skill-slash-index"
  | "data-workspace-file-reference-index";

/** Composer 建议菜单焦点留在输入框，须手动把键盘选中项滚入 ScrollArea 可视区 */
export function useComposerSuggestionMenuKeyboardScroll(
  selectedIndex: number,
  menuRef: RefObject<HTMLElement | null>,
  itemDataAttribute: ComposerSuggestionItemDataAttribute,
) {
  useLayoutEffect(() => {
    if (selectedIndex < 0 || !menuRef.current) {
      return;
    }

    const item = menuRef.current.querySelector<HTMLElement>(
      `[${itemDataAttribute}="${selectedIndex}"]`,
    );
    if (!item) {
      return;
    }

    const viewport = item.closest<HTMLElement>("[data-radix-scroll-area-viewport]");
    if (!viewport) {
      return;
    }

    scrollIntoViewportWithPadding(viewport, item, menuRef.current.parentElement);
  }, [itemDataAttribute, menuRef, selectedIndex]);
}

import { useEffect, useState } from "react";

/**
 * 键盘默认选中仅服务非鼠标用户；指针进入菜单后与之互斥，离开菜单后全部高亮消失（不恢复键盘项）。
 */
export function useComposerSuggestionMenuHighlight(selectedIndex: number, itemCount: number) {
  const [pointerHoveredIndex, setPointerHoveredIndex] = useState<number | null>(null);
  const [pointerDismissedHighlight, setPointerDismissedHighlight] = useState(false);

  useEffect(() => {
    setPointerHoveredIndex(null);
    setPointerDismissedHighlight(false);
  }, [itemCount, selectedIndex]);

  const highlightedIndex = pointerDismissedHighlight ? -1 : (pointerHoveredIndex ?? selectedIndex);

  return {
    highlightedIndex,
    menuPointerHandlers: {
      onMouseLeave: () => {
        setPointerHoveredIndex(null);
        setPointerDismissedHighlight(true);
      },
    },
    getItemPointerHandlers: (index: number) => ({
      onMouseEnter: () => {
        setPointerDismissedHighlight(false);
        setPointerHoveredIndex(index);
      },
    }),
  };
}

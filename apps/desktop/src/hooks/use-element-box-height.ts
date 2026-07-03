import { useCallback, useLayoutEffect, useState } from "react";

/**
 * 观测元素 border-box 高度（px，向上取整），供叠层与滚动区 padding 对齐。
 *
 * 必须在 layout effect 中同步量取：滚动床 padding 由该高度推导，若等 paint 后
 * 才更新（useEffect / RO 回调），换页首帧会用陈旧高度布局，随后 padding 收缩
 * 引发 scrollHeight 突变与可见位移。`remeasureKey` 变化（如空会话 ↔ 有内容
 * 会话的 composer 布局切换）时在同一 commit 内 pre-paint 重测。
 */
export function useElementBoxHeight<T extends HTMLElement>(remeasureKey?: unknown) {
  const [element, setElement] = useState<T | null>(null);
  const [heightPx, setHeightPx] = useState(0);
  const ref = useCallback((node: T | null) => {
    setElement(node);
  }, []);

  useLayoutEffect(() => {
    if (!element) {
      setHeightPx(0);
      return;
    }

    const syncHeight = () => {
      setHeightPx(Math.ceil(element.getBoundingClientRect().height));
    };

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, remeasureKey]);

  return { ref, heightPx };
}

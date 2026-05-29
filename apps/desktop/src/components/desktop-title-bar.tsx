import { cn } from "@/lib/utils";

const MENU_ENTRIES = [
  { label: "文件", section: "file" as const },
  { label: "编辑", section: "edit" as const },
  { label: "查看", section: "view" as const },
  { label: "窗口", section: "window" as const },
  { label: "帮助", section: "help" as const },
];

/** 与 [`App.tsx`](../App.tsx) 侧栏壳层宽度一致 */
const SESSION_SIDEBAR_WIDTH_CLASS = "w-[min(16rem,40vw)]";

function popupMenuAtAnchor(
  el: HTMLElement,
  section: (typeof MENU_ENTRIES)[number]["section"],
): void {
  const r = el.getBoundingClientRect();
  void window.spiritDesktop?.popupApplicationMenu(section, r.left, r.bottom);
}

type DesktopTitleBarProps = {
  /** 与根布局云母透明策略一致 */
  useMicaBackdrop: boolean;
  /** 侧栏展开时底部分割线仅在主内容区，与侧栏右边线相接 */
  sessionSidebarOpen: boolean;
};

function titleBarSurfaceClass(
  useMicaBackdrop: boolean,
  withBorder: boolean,
  zone: "sidebar" | "main",
) {
  return cn(
    withBorder && (useMicaBackdrop ? "border-black/5 dark:border-white/10" : "border-border/40"),
    useMicaBackdrop
      ? "bg-transparent"
      : zone === "sidebar"
        ? "bg-sidebar dark:bg-background"
        : "bg-background",
  );
}

function TitleBarMenuCluster() {
  return (
    <>
      <img
        src="/favicon.ico"
        alt=""
        width={20}
        height={20}
        draggable={false}
        className="electron-no-drag size-5 shrink-0 rounded-sm opacity-90"
      />
      <nav
        className="electron-no-drag flex items-center gap-0.5 text-[13px] leading-none"
        aria-label="应用菜单"
      >
        {MENU_ENTRIES.map(({ label, section }) => (
          <button
            key={section}
            type="button"
            className="rounded px-2 py-1.5 text-foreground/90 hover:bg-foreground/10 dark:hover:bg-white/10"
            onClick={(e) => popupMenuAtAnchor(e.currentTarget, section)}
          >
            {label}
          </button>
        ))}
      </nav>
    </>
  );
}

/**
 * Windows：自绘顶栏（LOGO + 菜单文案），窗口控制键仍由 `titleBarOverlay` 绘制。
 */
export function DesktopTitleBar({ useMicaBackdrop, sessionSidebarOpen }: DesktopTitleBarProps) {
  if (!sessionSidebarOpen) {
    return (
      <header
        className={cn(
          "electron-drag flex h-8 w-full shrink-0 items-center gap-1 border-b pl-2",
          titleBarSurfaceClass(useMicaBackdrop, true, "sidebar"),
        )}
      >
        <TitleBarMenuCluster />
        <div className="electron-drag min-h-0 min-w-0 flex-1" aria-hidden />
      </header>
    );
  }

  return (
    <header className="flex h-8 w-full shrink-0">
      <div
        className={cn(
          "electron-drag flex h-8 shrink-0 items-center gap-1 pl-2",
          SESSION_SIDEBAR_WIDTH_CLASS,
          titleBarSurfaceClass(useMicaBackdrop, false, "sidebar"),
        )}
      >
        <TitleBarMenuCluster />
      </div>
      {/* 底部分割线仅覆盖主内容区，与侧栏 `border-r` 在顶角自然衔接 */}
      <div
        className={cn(
          "electron-drag h-8 min-w-0 flex-1 border-b",
          titleBarSurfaceClass(useMicaBackdrop, true, "main"),
        )}
        aria-hidden
      />
    </header>
  );
}

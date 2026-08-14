import { cn } from "@/lib/utils";

type DesktopMacTrafficLightsProps = {
  className?: string;
};

/** Landing 预览用 macOS 红绿灯装饰（对齐 Desktop hiddenInset 顶栏安全区）。 */
export function DesktopMacTrafficLights({ className }: DesktopMacTrafficLightsProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute top-0 left-0 z-30 flex h-8 w-[4.875rem] items-center gap-2 pl-3",
        className,
      )}
      aria-hidden
    >
      <span className="size-3 rounded-full bg-[#1a1a1a] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]" />
      <span className="size-3 rounded-full bg-[#1a1a1a] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]" />
      <span className="size-3 rounded-full bg-[#1a1a1a] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]" />
    </div>
  );
}

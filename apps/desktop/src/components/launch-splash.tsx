import { useEffect, useLayoutEffect, useState } from "react";

import { SpiritGlassLogo, spiritGlassLogoMaskStyle } from "@spiritagent/brand";

import { desktopFullscreenOverlayTintClass } from "@/lib/desktop-translucency-surface";
import type { ShellOverlayPhase } from "@/lib/desktop-shell";
import { cn } from "@/lib/utils";

const LAUNCH_LOGO_WIDTH_PX = 72;

const EXIT_MS = 520;

/** 加载结束后延迟再播退场（毫秒），0 表示立即退场 */
const EXIT_DELAY_BEFORE_MS = 0;

type Phase = "running" | "leaving" | "gone";

type LaunchSplashProps = {
  /** 为 true 时显示加载态；变为 false 时播放退场后卸载 */
  active: boolean;
  /** translucency（Win Mica / macOS Vibrancy）：与 app-shell / 会话主区一致，开启时用主区半透明 tint。 */
  useTranslucency?: boolean;
  /** 挂载周期内 phase 变化（供宿主在 leaving 前勿提前露出 app-body）。 */
  onPhaseChange?: (phase: ShellOverlayPhase) => void;
};

/**
 * 首屏启动：居中品牌图标 + 骨架屏式线性闪光，宿主就绪后淡出。
 * Blur 开启时使用与会话页相同的主区半透明 tint（`bg-background/70`）。
 * 退场时整层（含背景 tint）随容器 opacity 淡出；下方 app-body 由 styles.css 规则提前以
 * opacity 隐藏并保持栅格化，退场时以补偿曲线淡入就位——背景与主内容由此完成交叉衔接，而非硬切。
 */
export function LaunchSplash({
  active,
  useTranslucency = false,
  onPhaseChange,
}: LaunchSplashProps) {
  const [phase, setPhase] = useState<Phase>(() => (active ? "running" : "gone"));

  useEffect(() => {
    if (active) {
      setPhase("running");
      return;
    }
    const id = window.setTimeout(() => {
      setPhase((current) => {
        if (current === "running" || current === "leaving") {
          return "leaving";
        }
        return current;
      });
    }, EXIT_DELAY_BEFORE_MS);
    return () => window.clearTimeout(id);
  }, [active]);

  useEffect(() => {
    if (phase !== "leaving") {
      return;
    }
    const id = window.setTimeout(() => {
      setPhase("gone");
    }, EXIT_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  useLayoutEffect(() => {
    onPhaseChange?.(phase);
  }, [onPhaseChange, phase]);

  useLayoutEffect(() => {
    if (!active || phase !== "running") {
      return;
    }
    window.spiritDesktop?.notifyLaunchSplashReady?.();
  }, [active, phase]);

  if (phase === "gone") {
    return null;
  }

  const exiting = phase === "leaving";

  return (
    <div
      data-spirit-surface="launch-splash"
      aria-hidden={exiting}
      className={cn(
        "fixed inset-0 z-[200] flex items-center justify-center",
        desktopFullscreenOverlayTintClass(useTranslucency),
        "transition-opacity duration-500 ease-out motion-reduce:duration-200",
        exiting ? "pointer-events-none opacity-0" : "opacity-100",
      )}
    >
      <div
        className={cn(
          "relative shrink-0 transition-[opacity,transform] duration-[420ms] ease-out motion-reduce:duration-150",
          exiting ? "scale-[0.97] opacity-0 motion-reduce:scale-100" : "scale-100 opacity-100",
        )}
        style={{ width: LAUNCH_LOGO_WIDTH_PX }}
      >
        <SpiritGlassLogo width={LAUNCH_LOGO_WIDTH_PX} className="relative z-0" />
        <div
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
          style={spiritGlassLogoMaskStyle()}
          aria-hidden
        >
          <div className="spirit-launch-shimmer-sweep" />
        </div>
      </div>
    </div>
  );
}

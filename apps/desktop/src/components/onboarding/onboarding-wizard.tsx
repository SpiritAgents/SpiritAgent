import { cn } from "@/lib/utils";

type OnboardingWizardProps = {
  /** 为 true 时显示向导；变为 false 时直接卸载。 */
  active: boolean;
  /** Windows Mica / macOS Vibrancy：与 launch-splash 一致，开启时透出原生模糊。 */
  useMicaBackdrop?: boolean;
  /** 点击 Done：由宿主持久化 onboardingCompleted 并关闭向导。 */
  onDone: () => void;
};

/**
 * 首启引导（OOBE）向导：全窗覆盖层，层级低于 LaunchSplash（z-200），
 * 启动闪屏淡出后自然露出。三步流程：欢迎 / 外观 / 连接提供商。
 */
export function OnboardingWizard({
  active,
  useMicaBackdrop = false,
  onDone,
}: OnboardingWizardProps) {
  void onDone;
  if (!active) {
    return null;
  }

  return (
    <div
      data-spirit-surface="onboarding-wizard"
      className={cn(
        "fixed inset-0 z-[190] flex flex-col",
        useMicaBackdrop ? "bg-transparent" : "bg-background",
      )}
    />
  );
}

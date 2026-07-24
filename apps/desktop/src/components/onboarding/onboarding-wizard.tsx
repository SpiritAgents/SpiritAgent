import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { OnboardingAppearanceControls } from "@/components/onboarding/onboarding-appearance-step";
import { OnboardingConnectControls } from "@/components/onboarding/onboarding-connect-step";
import type { SettingsFormState } from "@/components/settings/types";
import { SpiritGlassLogo, spiritGlassLogoMaskStyle } from "@/components/spirit-glass-logo";
import { Button } from "@/components/ui/button";
import { DESKTOP_PAGE_TITLE_CLASS } from "@/lib/desktop-typography";
import { desktopFullscreenOverlayTintClass } from "@/lib/desktop-mica-surface";
import { syncLaunchSplashChromeToDocument, type ShellOverlayPhase } from "@/lib/desktop-shell";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import type {
  AddModelRequest,
  AddProviderModelsRequest,
  PreviewModelsRequest,
  PreviewModelsResponse,
} from "@/types";

const ONBOARDING_LOGO_WIDTH_PX = 104;

/** 与 styles.css `spirit-oobe-step-exit-*` 时长一致 */
const STEP_EXIT_MS = 200;
/** 点击 Done 后整层淡出时长 */
const WIZARD_EXIT_MS = 360;
/** 欢迎步进入后多久淡入产品名（自 Step 1 进入起算，与 snapshot 无关） */
const WELCOME_TITLE_DELAY_MS = 500;
/** 欢迎步进入后多久淡入 Continue（自 Step 1 进入起算，与 snapshot 无关） */
const WELCOME_CONTINUE_DELAY_MS = 1000;
/** 与 styles.css `.spirit-launch-shimmer-sweep` 单次 sweep 时长一致 */
const LAUNCH_SHIMMER_CYCLE_MS = 2900;
/** 在 CSS iteration 跳回 125% 之前结束 shimmer，避免视觉上「新一轮刚起就被切」 */
const SHIMMER_FINISH_BEFORE_ITERATION_MS = 120;

/** 读取 shimmer sweep 距当前轮次结束的剩余时长（Web Animations API，略提前于 iteration 边界）。 */
function readShimmerRemainingMs(el: HTMLElement): number {
  const anim = el.getAnimations()[0];
  if (anim != null && anim.currentTime != null) {
    const timing = anim.effect?.getComputedTiming();
    const duration =
      typeof timing?.duration === "number" && timing.duration > 0
        ? timing.duration
        : LAUNCH_SHIMMER_CYCLE_MS;
    const phase = Number(anim.currentTime) % duration;
    const untilIteration = phase === 0 ? duration : duration - phase;
    return Math.max(0, untilIteration - SHIMMER_FINISH_BEFORE_ITERATION_MS);
  }
  return LAUNCH_SHIMMER_CYCLE_MS - SHIMMER_FINISH_BEFORE_ITERATION_MS;
}

type WizardPhase = "running" | "leaving" | "gone";
type OnboardingStep = 1 | 2 | 3;
type StepDirection = "forward" | "backward";

type LeavingStepState = {
  step: OnboardingStep;
  direction: StepDirection;
  /** Step 3 离场动画期间冻结列表底缘渐隐，避免 remount 后遮罩闪没。 */
  connectBottomFade?: boolean;
};

type OnboardingWizardProps = {
  /** 为 true 时显示向导；变为 false 时播放淡出后卸载。 */
  active: boolean;
  /** Windows Mica / macOS Vibrancy：与 launch-splash / 会话主区一致，开启时用主区半透明 tint。 */
  useMicaBackdrop?: boolean;
  settings: SettingsFormState;
  onSavePatch: (patch: Partial<SettingsFormState>) => Promise<void>;
  modelsBusy: boolean;
  modelsPreviewBusy: boolean;
  onAddModel: (request: AddModelRequest) => Promise<void>;
  onAddProviderModels: (request: AddProviderModelsRequest) => Promise<void>;
  onPreviewModels: (request: PreviewModelsRequest) => Promise<PreviewModelsResponse>;
  /** 点击 Done：由宿主持久化 onboardingCompleted 并关闭向导。 */
  onDone: () => void;
  /** 挂载周期内 phase 变化（供宿主在 leaving 前勿提前露出 app-body）。 */
  onPhaseChange?: (phase: ShellOverlayPhase) => void;
};

/** 入场 stagger 用内容块标记：index 越大出场越晚（40ms 递进）。 */
function oobeBlockProps(index: number): {
  "data-oobe-block": true;
  style: CSSProperties;
} {
  return {
    "data-oobe-block": true,
    style: { "--spirit-oobe-block": index } as CSSProperties,
  };
}

/**
 * 首启引导（OOBE）向导：全窗覆盖层，层级低于 LaunchSplash（z-200）与
 * Radix 浮层（z-50），高于主 UI。三步流程：欢迎 / 外观 / 连接提供商。
 */
export function OnboardingWizard({
  active,
  useMicaBackdrop = false,
  settings,
  onSavePatch,
  modelsBusy,
  modelsPreviewBusy,
  onAddModel,
  onAddProviderModels,
  onPreviewModels,
  onDone,
  onPhaseChange,
}: OnboardingWizardProps) {
  const [phase, setPhase] = useState<WizardPhase>(() => (active ? "running" : "gone"));
  const [step, setStep] = useState<OnboardingStep>(1);
  /**
   * 最近一次导航方向。必须是独立 state 而非从 leavingStep 派生：
   * 派生值会在出场节点清除后回落，导致入场节点 class 换名、CSS 动画从头重播。
   */
  const [direction, setDirection] = useState<StepDirection>("forward");
  /** 首次进入 Step 1 不播放入场动画；用户手动继续/返回后才启用。 */
  const [hasManualNavigation, setHasManualNavigation] = useState(false);
  /** 出场中的旧步骤；动画播完后清除。 */
  const [leavingStep, setLeavingStep] = useState<LeavingStepState | null>(null);
  /** Step 3 列表底缘渐隐快照，供离场 remount 冻结遮罩。 */
  const connectBottomFadeRef = useRef(false);
  const handleConnectBottomFadeChange = useCallback((hasMoreBelow: boolean) => {
    connectBottomFadeRef.current = hasMoreBelow;
  }, []);

  useEffect(() => {
    if (active) {
      setPhase("running");
      return;
    }
    setPhase((current) => (current === "gone" ? current : "leaving"));
  }, [active]);

  useEffect(() => {
    if (phase !== "leaving") {
      return;
    }
    const id = window.setTimeout(() => {
      setPhase("gone");
    }, WIZARD_EXIT_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  useEffect(() => {
    if (leavingStep === null) {
      return;
    }
    const id = window.setTimeout(() => {
      setLeavingStep(null);
    }, STEP_EXIT_MS);
    return () => window.clearTimeout(id);
  }, [leavingStep]);

  useLayoutEffect(() => {
    if (phase === "gone") {
      syncLaunchSplashChromeToDocument("gone");
      return;
    }
    syncLaunchSplashChromeToDocument(phase === "leaving" ? "leaving" : "running");
    return () => {
      syncLaunchSplashChromeToDocument("gone");
    };
  }, [phase]);

  useLayoutEffect(() => {
    onPhaseChange?.(phase);
  }, [onPhaseChange, phase]);

  if (phase === "gone") {
    return null;
  }

  const goToStep = (next: OnboardingStep) => {
    if (next === step) {
      return;
    }
    const nextDirection: StepDirection = next > step ? "forward" : "backward";
    setHasManualNavigation(true);
    setDirection(nextDirection);
    setLeavingStep({
      step,
      direction: nextDirection,
      ...(step === 3 ? { connectBottomFade: connectBottomFadeRef.current } : {}),
    });
    setStep(next);
  };

  const exiting = phase === "leaving";

  const renderStep = (
    target: OnboardingStep,
    options?: Pick<LeavingStepState, "connectBottomFade"> & { leaving?: boolean },
  ): ReactNode => {
    switch (target) {
      case 1:
        return (
          <OnboardingWelcomeStep onContinue={() => goToStep(2)} />
        );
      case 2:
        return (
          <OnboardingAppearanceStep
            settings={settings}
            onSavePatch={onSavePatch}
            onBack={() => goToStep(1)}
            onContinue={() => goToStep(3)}
          />
        );
      case 3:
        return (
          <OnboardingConnectStep
            modelsBusy={modelsBusy}
            modelsPreviewBusy={modelsPreviewBusy}
            onAddModel={onAddModel}
            onAddProviderModels={onAddProviderModels}
            onPreviewModels={onPreviewModels}
            onBack={() => goToStep(2)}
            onDone={onDone}
            onBottomFadeChange={options?.leaving ? undefined : handleConnectBottomFadeChange}
            pinnedBottomFade={options?.leaving ? options.connectBottomFade : undefined}
            freezeBottomFade={options?.leaving === true}
          />
        );
    }
  };

  return (
    <div
      data-spirit-surface="onboarding-wizard"
      aria-hidden={exiting}
      className={cn(
        // z-40：低于 Radix 浮层（Dialog/Select 等 z-50），向导内弹窗才能置顶；
        // 仍高于主 UI，保证淡出期间盖住已恢复可见的 app-body。
        "fixed inset-0 z-40 flex flex-col",
        desktopFullscreenOverlayTintClass(useMicaBackdrop, exiting),
        "transition-opacity duration-[360ms] ease-out motion-reduce:duration-150",
        exiting ? "pointer-events-none opacity-0" : "opacity-100",
      )}
    >
      <div className="relative min-h-0 flex-1">
        {leavingStep !== null ? (
          <div
            key={`oobe-leaving-${leavingStep.step}`}
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0",
              leavingStep.direction === "forward"
                ? "spirit-oobe-step-exit-forward"
                : "spirit-oobe-step-exit-backward",
            )}
          >
            {renderStep(leavingStep.step, {
              leaving: true,
              connectBottomFade: leavingStep.connectBottomFade,
            })}
          </div>
        ) : null}
        <div
          key={`oobe-step-${step}`}
          className={cn(
            "absolute inset-0",
            hasManualNavigation &&
              (direction === "forward"
                ? "spirit-oobe-step-enter-forward"
                : "spirit-oobe-step-enter-backward"),
          )}
        >
          {renderStep(step)}
        </div>
      </div>
    </div>
  );
}

/** Step 2/3 通用布局 + 底部导航行。 */
function OnboardingStepShell({
  title,
  children,
  footer,
  contentLayout = "spread",
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
  /**
   * spread：标题顶对齐、内容区 flex-1（Step 3 长列表）。
   * centered：标题与内容成组垂直居中，标题紧贴内容上方（Step 2）。
   */
  contentLayout?: "spread" | "centered";
}) {
  if (contentLayout === "centered") {
    return (
      <div className="flex h-full min-h-0 flex-col items-center px-8 pb-8">
        <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center">
          <h1 {...oobeBlockProps(0)} className={cn("shrink-0", DESKTOP_PAGE_TITLE_CLASS)}>
            {title}
          </h1>
          <div {...oobeBlockProps(1)} className="flex w-full flex-col items-center pt-8">
            {children}
          </div>
        </div>
        <div {...oobeBlockProps(2)} className="flex shrink-0 items-center gap-3 pt-6">
          {footer}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col items-center px-8 pt-14 pb-8">
      <h1 {...oobeBlockProps(0)} className={cn("shrink-0", DESKTOP_PAGE_TITLE_CLASS)}>
        {title}
      </h1>
      <div
        {...oobeBlockProps(1)}
        className="flex min-h-0 w-full flex-1 flex-col items-center pt-8"
      >
        {children}
      </div>
      <div {...oobeBlockProps(2)} className="flex shrink-0 items-center gap-3 pt-6">
        {footer}
      </div>
    </div>
  );
}

/** Step 1：居中品牌图标与产品名；自进入 0.5s / 1s 固定时序淡入标题与 Continue；Shimmer 独立播完当前轮。 */
function OnboardingWelcomeStep({
  onContinue,
}: {
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  const [titleVisible, setTitleVisible] = useState(false);
  const [continueVisible, setContinueVisible] = useState(false);
  const [shimmerActive, setShimmerActive] = useState(true);
  const shimmerSweepRef = useRef<HTMLDivElement>(null);

  // Shimmer 与 Continue 解耦：挂载时按当前 sweep 相位预约自然结束，不阻塞按钮
  useLayoutEffect(() => {
    const el = shimmerSweepRef.current;
    if (!el) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShimmerActive(false);
      return;
    }
    const remainingMs = readShimmerRemainingMs(el);
    const id = window.setTimeout(() => {
      setShimmerActive(false);
    }, remainingMs);
    return () => window.clearTimeout(id);
  }, []);

  // 自 Step 1 进入起固定计时，与 snapshot 就绪无关（首次进入与 Step 2 返回体感一致）
  useEffect(() => {
    setTitleVisible(false);
    setContinueVisible(false);

    const titleTimeout = window.setTimeout(() => setTitleVisible(true), WELCOME_TITLE_DELAY_MS);

    const continueId = window.setTimeout(() => {
      setContinueVisible(true);
    }, WELCOME_CONTINUE_DELAY_MS);

    return () => {
      window.clearTimeout(titleTimeout);
      window.clearTimeout(continueId);
    };
  }, []);

  return (
    <div
      {...oobeBlockProps(0)}
      className="flex h-full flex-col items-center justify-center"
    >
      <div className="relative shrink-0" style={{ width: ONBOARDING_LOGO_WIDTH_PX }}>
        <SpiritGlassLogo width={ONBOARDING_LOGO_WIDTH_PX} className="relative z-0" />
        {/* 保持 DOM 稳定挂载，避免重渲染 remount 导致 sweep 从 125% 重启 */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-10 overflow-hidden",
            !shimmerActive && "invisible",
          )}
          style={spiritGlassLogoMaskStyle()}
          aria-hidden={!shimmerActive}
        >
          <div
            ref={shimmerSweepRef}
            className={cn(
              "spirit-launch-shimmer-sweep",
              !shimmerActive && "animate-none opacity-0",
            )}
          />
        </div>
      </div>
      <p
        className={cn(
          "mt-7 text-2xl font-normal tracking-tight text-foreground",
          "transition-opacity duration-200 ease-out",
          titleVisible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!titleVisible}
      >
        {t("onboarding.welcomeTitle")}
      </p>
      <Button
        type="button"
        onClick={onContinue}
        className={cn(
          "mt-8 min-w-36",
          "transition-opacity duration-200 ease-out",
          continueVisible ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!continueVisible}
        tabIndex={continueVisible ? undefined : -1}
      >
        {t("onboarding.continue")}
      </Button>
    </div>
  );
}

/** Step 2：外观（主题 / 模糊效果 / 语言）。theme 就地订阅，App 无需下传。 */
function OnboardingAppearanceStep({
  settings,
  onSavePatch,
  onBack,
  onContinue,
}: {
  settings: SettingsFormState;
  onSavePatch: (patch: Partial<SettingsFormState>) => Promise<void>;
  onBack: () => void;
  onContinue: () => void;
}) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  return (
    <OnboardingStepShell
      contentLayout="centered"
      title={t("onboarding.appearanceTitle")}
      footer={
        <>
          <Button type="button" variant="outline" className="min-w-28" onClick={onBack}>
            {t("onboarding.back")}
          </Button>
          <Button type="button" className="min-w-28" onClick={onContinue}>
            {t("onboarding.continue")}
          </Button>
        </>
      }
    >
      <OnboardingAppearanceControls
        theme={theme}
        onThemeChange={setTheme}
        settings={settings}
        onSavePatch={onSavePatch}
      />
    </OnboardingStepShell>
  );
}

/** Step 3：连接提供商（可跳过）。 */
function OnboardingConnectStep({
  modelsBusy,
  modelsPreviewBusy,
  onAddModel,
  onAddProviderModels,
  onPreviewModels,
  onBack,
  onDone,
  onBottomFadeChange,
  pinnedBottomFade,
  freezeBottomFade = false,
}: {
  modelsBusy: boolean;
  modelsPreviewBusy: boolean;
  onAddModel: (request: AddModelRequest) => Promise<void>;
  onAddProviderModels: (request: AddProviderModelsRequest) => Promise<void>;
  onPreviewModels: (request: PreviewModelsRequest) => Promise<PreviewModelsResponse>;
  onBack: () => void;
  onDone: () => void;
  onBottomFadeChange?: (hasMoreBelow: boolean) => void;
  /** 离场 remount 时恢复离开前的底缘渐隐可见性。 */
  pinnedBottomFade?: boolean;
  /** 离场动画期间冻结底缘渐隐，禁止 scroll 监听改写。 */
  freezeBottomFade?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <OnboardingStepShell
      title={t("onboarding.connectTitle")}
      footer={
        <>
          <Button type="button" variant="outline" className="min-w-28" onClick={onBack}>
            {t("onboarding.back")}
          </Button>
          <Button type="button" className="min-w-28" onClick={onDone}>
            {t("onboarding.done")}
          </Button>
        </>
      }
    >
      <OnboardingConnectControls
        modelsBusy={modelsBusy}
        modelsPreviewBusy={modelsPreviewBusy}
        onAddModel={onAddModel}
        onAddProviderModels={onAddProviderModels}
        onPreviewModels={onPreviewModels}
        onBottomFadeChange={onBottomFadeChange}
        pinnedBottomFade={pinnedBottomFade}
        freezeBottomFade={freezeBottomFade}
      />
    </OnboardingStepShell>
  );
}

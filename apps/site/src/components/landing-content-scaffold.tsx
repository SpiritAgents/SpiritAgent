import { LandingFeatureDemoBox } from "@/components/landing-feature-demo-box";
import { LandingVisibleDesktopWindow } from "@/components/landing-visible-desktop-window";
import { protectBrandTokens } from "@/components/no-translate";
import { useI18n } from "@/i18n/provider";
import {
  LANDING_FEATURE_FRAME_CLASS,
  LANDING_FEATURE_GRID_REVERSED_CLASS,
} from "@/lib/site-layout";
import { FONT_WEIGHT_MEDIUM } from "@/lib/typography";

export function LandingContentScaffold() {
  const { messages } = useI18n();

  return (
    <section
      id="docs"
      className="relative overflow-hidden bg-background"
      aria-label={messages.landing.sectionAria}
    >
      <div
        className={`${LANDING_FEATURE_FRAME_CLASS} mx-auto flex flex-col py-28 sm:py-32 lg:py-40`}
      >
        <section id="features" className={LANDING_FEATURE_GRID_REVERSED_CLASS}>
          <div className="flex h-full items-center lg:col-start-2 lg:row-start-1 lg:justify-end">
            <div className="max-w-xl space-y-4">
              <h2
                className={`max-w-lg text-[2.2rem] leading-[1.02] ${FONT_WEIGHT_MEDIUM} tracking-[-0.05em] text-foreground sm:text-[2.9rem]`}
              >
                {messages.landing.featureHeading[0]}
                <br />
                {messages.landing.featureHeading[1]}
                <br />
                {messages.landing.featureHeading[2]}
              </h2>
              <p className="max-w-md text-[1.05rem] leading-relaxed text-foreground/66 sm:text-[1.15rem]">
                {protectBrandTokens(messages.landing.featureBody)}
              </p>
            </div>
          </div>

          <LandingFeatureDemoBox className="lg:col-start-1 lg:row-start-1">
            <LandingVisibleDesktopWindow
              initialSurface="settings"
              initialSettingsTab="models"
              className="relative min-h-0 w-full max-w-none flex-1"
              viewportClassName="flex h-full min-h-0 w-full flex-1 flex-col"
            />
          </LandingFeatureDemoBox>
        </section>
      </div>
    </section>
  );
}

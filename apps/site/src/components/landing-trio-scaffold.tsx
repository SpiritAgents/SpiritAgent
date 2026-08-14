import { LandingCodeCompletionDemo } from "@/components/landing-code-completion-demo";
import { LandingFeatureDemoBox } from "@/components/landing-feature-demo-box";
import { LandingToolCardsDemo } from "@/components/landing-tool-cards-demo";
import { NoTranslate } from "@/components/no-translate";
import { useI18n } from "@/i18n/provider";
import {
  LANDING_FEATURE_FRAME_CLASS,
  LANDING_TRIO_DEMO_BOX_FRAME_CLASS,
  LANDING_TRIO_GRID_CLASS,
} from "@/lib/site-layout";
import { FONT_WEIGHT_MEDIUM } from "@/lib/typography";

export function LandingTrioScaffold() {
  const { messages } = useI18n();
  const { completion, toolCards, placeholder } = messages.landing.trio;

  const trioItems = [
    {
      id: "completion",
      title: completion.title,
      body: completion.body,
      demo: "completion" as const,
    },
    {
      id: "toolCards",
      title: toolCards.title,
      body: toolCards.body,
      demo: "toolCards" as const,
    },
    {
      id: "placeholder-three",
      title: placeholder.title,
      body: placeholder.body,
      demo: null,
    },
  ];

  return (
    <section
      id="highlights"
      className="relative overflow-hidden bg-[#000000]"
      aria-label={messages.landing.trio.sectionAria}
    >
      <div
        className={`${LANDING_FEATURE_FRAME_CLASS} mx-auto flex flex-col py-28 sm:py-32 lg:py-40`}
      >
        <div className={LANDING_TRIO_GRID_CLASS}>
          {trioItems.map((item) => (
            <article key={item.id} className="flex min-w-0 flex-col gap-4 sm:gap-5">
              {item.demo === "completion" ? (
                <LandingFeatureDemoBox
                  frameClassName={LANDING_TRIO_DEMO_BOX_FRAME_CLASS}
                  innerClassName="overflow-hidden"
                >
                  <LandingCodeCompletionDemo className="absolute top-5 left-5 h-[118%] w-[128%] origin-top-left sm:top-6 sm:left-6" />
                </LandingFeatureDemoBox>
              ) : item.demo === "toolCards" ? (
                <LandingFeatureDemoBox
                  frameClassName={LANDING_TRIO_DEMO_BOX_FRAME_CLASS}
                  innerClassName="overflow-hidden"
                >
                  <LandingToolCardsDemo className="absolute inset-0" />
                </LandingFeatureDemoBox>
              ) : (
                <LandingFeatureDemoBox frameClassName={LANDING_TRIO_DEMO_BOX_FRAME_CLASS}>
                  <p className="flex h-full items-center justify-center text-2xl text-white/45 sm:text-3xl">
                    None.
                  </p>
                </LandingFeatureDemoBox>
              )}
              <div className="space-y-2">
                <h3
                  className={`text-[1.35rem] leading-[1.06] ${FONT_WEIGHT_MEDIUM} tracking-[-0.04em] text-white sm:text-[1.5rem]`}
                >
                  {item.id === "completion" ? <NoTranslate>{item.title}</NoTranslate> : item.title}
                </h3>
                <p className="text-[0.95rem] leading-relaxed text-white/66 sm:text-[1.05rem]">
                  {item.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

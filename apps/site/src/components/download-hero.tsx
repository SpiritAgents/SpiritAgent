import { SiteGradientBackground } from "@/components/site-gradient-background";
import { useI18n } from "@/i18n/provider";
import { FONT_WEIGHT_MEDIUM } from "@/lib/typography";

export function DownloadHero() {
  const { messages } = useI18n();

  return (
    <section
      className="relative z-10 flex w-full flex-col items-center justify-center overflow-hidden bg-background px-5 pt-32 pb-12 sm:pt-36 sm:pb-14"
      aria-label={messages.download.sectionAria}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <SiteGradientBackground className="absolute inset-0 block h-full w-full" />
      </div>

      <h1
        className={`relative z-10 text-center text-[clamp(1.5rem,3.5vw,2.5rem)] ${FONT_WEIGHT_MEDIUM} leading-none tracking-[-0.05em] text-foreground`}
      >
        {messages.download.title}
      </h1>
    </section>
  );
}

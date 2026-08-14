import { SiteGradientBackground } from "@/components/site-gradient-background";
import { SpiritDownloadButton } from "@/components/spirit-download-button";
import { SpiritGlassLogo } from "@/components/spirit-glass-logo";
import { protectBrandTokens } from "@/components/no-translate";
import { useI18n } from "@/i18n/provider";
import { FONT_WEIGHT_MEDIUM } from "@/lib/typography";

export function GlassLogoShowcase() {
  const { messages } = useI18n();
  return (
    <div className="relative z-10 flex w-full flex-col items-center justify-center overflow-hidden bg-black px-5 py-28 sm:py-32 lg:py-40">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <SiteGradientBackground className="absolute inset-0 block h-full w-full" />
      </div>

      <div
        className="relative inline-block overflow-visible"
        style={{ width: 120, height: 133, zIndex: 1 }}
      >
        <SpiritGlassLogo shimmer className="absolute inset-0 h-full w-full" />
      </div>

      <div className="relative z-10 mt-5 flex flex-col items-center gap-5 sm:mt-6 sm:gap-6">
        <p
          className={`text-[clamp(2rem,5vw,4rem)] ${FONT_WEIGHT_MEDIUM} leading-none tracking-[-0.05em] text-white`}
        >
          {protectBrandTokens(messages.landing.ctaTitle)}
        </p>
        <SpiritDownloadButton
          downloadVariant="platform"
          className="h-11 px-6 text-base"
          iconClassName="size-4"
        />
      </div>
    </div>
  );
}

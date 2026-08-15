"use client";

import { SiteGradientBackground } from "@/components/site-gradient-background";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { useI18n } from "@/i18n/provider";
import { FONT_WEIGHT_MEDIUM, FONT_WEIGHT_NORMAL } from "@/lib/typography";

export function DocsPage() {
  const { messages } = useI18n();
  const copy = messages.docs;

  return (
    <>
      <SiteNav />
      <main className="relative z-10">
        <section
          className="relative z-10 flex w-full flex-col items-center justify-center overflow-hidden bg-background px-5 pt-32 pb-28 sm:pt-36 sm:pb-32"
          aria-label={copy.sectionAria}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <SiteGradientBackground className="absolute inset-0 block h-full w-full" />
          </div>
          <h1
            className={`relative z-10 text-center text-[clamp(1.5rem,3.5vw,2.5rem)] ${FONT_WEIGHT_MEDIUM} leading-none tracking-[-0.05em] text-foreground`}
          >
            {copy.title}
          </h1>
          <p
            className={`relative z-10 mt-6 text-center text-lg text-foreground/45 ${FONT_WEIGHT_NORMAL}`}
          >
            {copy.comingSoon}
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

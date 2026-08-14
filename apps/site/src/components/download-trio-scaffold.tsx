import { LandingFeatureDemoBox } from "@/components/landing-feature-demo-box";
import { DownloadCliTerminalPreview } from "@/components/download-cli-terminal-preview";
import { DownloadCopyInstallButton } from "@/components/download-copy-install-button";
import { SpiritDesktopWindow } from "@/components/spirit-desktop-window";
import { SpiritDownloadButton } from "@/components/spirit-download-button";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import {
  LANDING_FEATURE_FRAME_CLASS,
  LANDING_TRIO_DEMO_BOX_FRAME_CLASS,
  LANDING_TRIO_GRID_CLASS,
} from "@/lib/site-layout";
import { FONT_WEIGHT_MEDIUM } from "@/lib/typography";
import { cn } from "@/lib/utils";

export function DownloadTrioScaffold() {
  const { messages } = useI18n();
  const copy = messages.download;

  const items = [
    {
      id: "desktop",
      title: copy.desktop,
      demo: "desktop" as const,
    },
    {
      id: "cli",
      title: copy.cli,
      demo: "cli" as const,
    },
    {
      id: "acp",
      title: copy.acp,
      demo: null,
    },
  ];

  return (
    <section
      id="download-channels"
      className="relative overflow-hidden bg-[#000000]"
      aria-label={copy.sectionAria}
    >
      <div
        className={`${LANDING_FEATURE_FRAME_CLASS} mx-auto flex flex-col pb-28 pt-6 sm:pb-32 sm:pt-8 lg:pb-40`}
      >
        <div className={LANDING_TRIO_GRID_CLASS}>
          {items.map((item) => (
            <article key={item.id} className="flex min-w-0 flex-col gap-4 sm:gap-5">
              {item.demo === "desktop" ? (
                <LandingFeatureDemoBox
                  frameClassName={LANDING_TRIO_DEMO_BOX_FRAME_CLASS}
                  innerClassName="overflow-hidden"
                >
                  {/* Uniform scale: nestedPreview only shrinks type, leaving sidebar full-width. */}
                  <div className="pointer-events-none absolute top-5 left-5 h-[182%] w-[182%] origin-top-left scale-[0.55] select-none sm:top-6 sm:left-6">
                    <SpiritDesktopWindow
                      useMicaBackdrop
                      heroBaseTone
                      demoStaticSnapshot="defaultEnd"
                      demoPlaybackActive={false}
                      initialWorkspaceToolsOpen={false}
                      className="h-full min-h-0 w-full"
                      viewportClassName="flex h-full min-h-0 flex-1 flex-col"
                    />
                  </div>
                </LandingFeatureDemoBox>
              ) : item.demo === "cli" ? (
                <LandingFeatureDemoBox
                  frameClassName={LANDING_TRIO_DEMO_BOX_FRAME_CLASS}
                  innerClassName="overflow-hidden"
                >
                  {/* Right-crop: wider than the cell; keep full inset height so the Agent input stays visible. */}
                  <DownloadCliTerminalPreview className="pointer-events-none absolute top-5 left-5 bottom-5 w-[128%] origin-top-left select-none sm:top-6 sm:left-6 sm:bottom-6" />
                </LandingFeatureDemoBox>
              ) : (
                <LandingFeatureDemoBox frameClassName={LANDING_TRIO_DEMO_BOX_FRAME_CLASS}>
                  <p className="flex h-full items-center justify-center text-2xl text-white/45 sm:text-3xl">
                    {copy.listingInProgress}
                  </p>
                </LandingFeatureDemoBox>
              )}

              <div className="flex flex-col items-start gap-3">
                <h2
                  className={`text-[1.35rem] leading-[1.06] ${FONT_WEIGHT_MEDIUM} tracking-[-0.04em] text-white sm:text-[1.5rem]`}
                >
                  {item.title}
                </h2>
                {item.demo === "desktop" ? (
                  <SpiritDownloadButton
                    downloadVariant="platform"
                    className="h-9 gap-1.5 px-4 text-[13px]"
                    iconClassName="size-3.5"
                  />
                ) : item.demo === "cli" ? (
                  <DownloadCopyInstallButton className="h-9 max-w-[70%] gap-1.5 px-4 text-[13px]" />
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled
                    className={cn(
                      "h-9 rounded-full border border-white/12 bg-white/10 px-4 text-[13px] text-white/50",
                      "disabled:opacity-60",
                    )}
                  >
                    {copy.comingSoon}
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

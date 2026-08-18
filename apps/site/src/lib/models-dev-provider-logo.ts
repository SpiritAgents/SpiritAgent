import type { DesktopModelProvider } from "@/types/spirit-desktop";

const MODELS_DEV_LOGO_ORIGIN = "https://models.dev";

/**
 * Spirit `ModelProviderId` → models.dev provider folder id.
 * models.dev serves a default sparkles SVG for unknown ids instead of a 404.
 */
const MODELS_DEV_LOGO_ID_ALIASES: Partial<Record<DesktopModelProvider, string>> = {
  "vercel-ai-gateway": "vercel",
};

export function modelsDevProviderLogoId(providerId: DesktopModelProvider): string {
  return MODELS_DEV_LOGO_ID_ALIASES[providerId] ?? providerId;
}

/** models.dev CDN logo URL. */
export function modelsDevProviderLogoUrl(providerId: DesktopModelProvider): string {
  return `${MODELS_DEV_LOGO_ORIGIN}/logos/${encodeURIComponent(modelsDevProviderLogoId(providerId))}.svg`;
}

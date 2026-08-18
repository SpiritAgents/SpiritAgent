import { useId } from "react";

import { SPIRIT_GLASS_LOGO_PATH, SPIRIT_GLASS_LOGO_VIEWBOX } from "./constants.js";

const MASK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SPIRIT_GLASS_LOGO_VIEWBOX.width} ${SPIRIT_GLASS_LOGO_VIEWBOX.height}"><path d="${SPIRIT_GLASS_LOGO_PATH}" fill="white"/></svg>`;

/** For the splash shimmer mask: matches the glass glyph outline */
export function spiritGlassLogoMaskStyle() {
  const mask = `url("data:image/svg+xml,${encodeURIComponent(MASK_SVG)}")`;
  return {
    WebkitMaskImage: mask,
    maskImage: mask,
    WebkitMaskSize: "contain",
    maskSize: "contain",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
  };
}

/**
 * spiritagent.app footer CTA glass brand logo (no shimmer).
 * Fill/stroke colors come from consumer-provided --spirit-agent-* CSS variables.
 */
export function SpiritGlassLogo({ width = 72, className, ...props }) {
  const uid = useId().replace(/:/g, "");
  const height = (width * SPIRIT_GLASS_LOGO_VIEWBOX.height) / SPIRIT_GLASS_LOGO_VIEWBOX.width;

  const fillId = `${uid}-fill`;
  const innerId = `${uid}-inner`;
  const fresnelId = `${uid}-fresnel`;
  const blurSmId = `${uid}-blur-sm`;
  const blurMdId = `${uid}-blur-md`;

  return (
    <svg
      viewBox={`0 0 ${SPIRIT_GLASS_LOGO_VIEWBOX.width} ${SPIRIT_GLASS_LOGO_VIEWBOX.height}`}
      width={width}
      height={height}
      aria-hidden
      className={["spirit-glass-logo block overflow-visible select-none", className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <defs>
        <linearGradient id={fillId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--spirit-agent-fill-strong)" />
          <stop offset="40%" stopColor="var(--spirit-agent-fill-mid)" />
          <stop offset="100%" stopColor="var(--spirit-agent-fill-tail)" />
        </linearGradient>

        <linearGradient id={innerId} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--spirit-agent-inner-strong)" />
          <stop offset="45%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" stopColor="var(--spirit-agent-inner-tail)" />
        </linearGradient>

        <linearGradient id={fresnelId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--spirit-agent-fresnel-a)" />
          <stop offset="25%" stopColor="var(--spirit-agent-fresnel-b)" />
          <stop offset="55%" stopColor="var(--spirit-agent-fresnel-c)" />
          <stop offset="100%" stopColor="var(--spirit-agent-fresnel-d)" />
        </linearGradient>

        <filter id={blurSmId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
        <filter id={blurMdId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      <path d={SPIRIT_GLASS_LOGO_PATH} fill={`url(#${fillId})`} />
      <path d={SPIRIT_GLASS_LOGO_PATH} fill={`url(#${innerId})`} />

      <path
        d={SPIRIT_GLASS_LOGO_PATH}
        fill="none"
        stroke={`url(#${fresnelId})`}
        strokeWidth="3"
        opacity="0.18"
        filter={`url(#${blurMdId})`}
      />

      <path
        d={SPIRIT_GLASS_LOGO_PATH}
        fill="none"
        stroke="var(--spirit-agent-stroke-main)"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />

      <path
        d={SPIRIT_GLASS_LOGO_PATH}
        fill="none"
        stroke="var(--spirit-agent-stroke-soft)"
        strokeWidth="1.5"
        filter={`url(#${blurSmId})`}
        opacity="0.5"
      />
    </svg>
  );
}

import { useId } from "react";

import { cn } from "@/lib/utils";

const LOGO_PATH =
  "M0 0L141.409 69.4512L70.7825 78.2408C61.5778 79.3863 53.5378 85.016 49.3132 93.2737L16.8979 156.635L0 0Z";

type SpiritGlassLogoProps = {
  className?: string;
  shimmer?: boolean;
};

/**
 * Glass Logo for the Landing preview. Colors come from the --spirit-glass-* CSS variables
 * (index.css, light/dark variants): white-alpha glass in dark mode, inverted to
 * black-alpha glass in light mode — otherwise it is invisible on a white background.
 */
export function SpiritGlassLogo({ className, shimmer = false }: SpiritGlassLogoProps) {
  const uid = useId().replace(/:/g, "");
  const fillId = `spirit-glass-fill-${uid}`;
  const innerId = `spirit-glass-inner-${uid}`;
  const fresnelId = `spirit-glass-fresnel-${uid}`;
  const blurSmId = `spirit-glass-blur-sm-${uid}`;
  const blurMdId = `spirit-glass-blur-md-${uid}`;
  const maskId = `spirit-glass-mask-${uid}`;
  const shimmerId = `spirit-glass-shimmer-${uid}`;

  return (
    <svg viewBox="0 0 142 157" aria-hidden className={cn("shrink-0 overflow-visible", className)}>
      <defs>
        <linearGradient id={fillId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "var(--spirit-glass-fill-0)" }} />
          <stop offset="40%" style={{ stopColor: "var(--spirit-glass-fill-40)" }} />
          <stop offset="100%" style={{ stopColor: "var(--spirit-glass-fill-100)" }} />
        </linearGradient>

        <linearGradient id={innerId} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: "var(--spirit-glass-inner-0)" }} />
          <stop offset="45%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" style={{ stopColor: "var(--spirit-glass-inner-100)" }} />
        </linearGradient>

        <linearGradient id={fresnelId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "var(--spirit-glass-fresnel-0)" }} />
          <stop offset="25%" style={{ stopColor: "var(--spirit-glass-fresnel-25)" }} />
          <stop offset="55%" style={{ stopColor: "var(--spirit-glass-fresnel-55)" }} />
          <stop offset="100%" style={{ stopColor: "var(--spirit-glass-fresnel-100)" }} />
        </linearGradient>

        <filter id={blurSmId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
        <filter id={blurMdId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" />
        </filter>

        <mask id={maskId}>
          <path d={LOGO_PATH} fill="white" />
        </mask>

        {shimmer ? (
          <linearGradient id={shimmerId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="28%" stopColor="rgba(255,255,255,0)" />
            <stop offset="42%" style={{ stopColor: "var(--spirit-glass-shimmer-mid)" }} />
            <stop offset="50%" style={{ stopColor: "var(--spirit-glass-shimmer-peak)" }} />
            <stop offset="58%" style={{ stopColor: "var(--spirit-glass-shimmer-mid)" }} />
            <stop offset="72%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        ) : null}
      </defs>

      <path d={LOGO_PATH} fill={`url(#${fillId})`} />
      <path d={LOGO_PATH} fill={`url(#${innerId})`} />
      <path
        d={LOGO_PATH}
        fill="none"
        stroke={`url(#${fresnelId})`}
        strokeWidth="3"
        opacity="0.18"
        filter={`url(#${blurMdId})`}
      />
      <path
        d={LOGO_PATH}
        fill="none"
        style={{ stroke: "var(--spirit-glass-stroke-crisp)" }}
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      <path
        d={LOGO_PATH}
        fill="none"
        style={{ stroke: "var(--spirit-glass-stroke-soft)" }}
        strokeWidth="1.5"
        filter={`url(#${blurSmId})`}
        opacity="0.5"
      />

      {shimmer ? (
        <g mask={`url(#${maskId})`} pointerEvents="none">
          <rect
            className="spirit-glass-shimmer"
            x="-400"
            y="-150"
            width="1000"
            height="500"
            fill={`url(#${shimmerId})`}
          />
        </g>
      ) : null}
    </svg>
  );
}

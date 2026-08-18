/**
 * Brand cursor glyph path: the single source of truth on the code side.
 * assets/*.svg embed the same path (static files cannot import it; the duplication is intentional);
 * when changing the glyph, update all SVGs under assets together with this constant.
 */
export const SPIRIT_GLASS_LOGO_PATH =
  "M0 0L141.409 69.4512L70.7825 78.2408C61.5778 79.3863 53.5378 85.016 49.3132 93.2737L16.8979 156.635L0 0Z";

export const SPIRIT_GLASS_LOGO_VIEWBOX = { width: 142, height: 157 };

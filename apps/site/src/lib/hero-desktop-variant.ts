export const HERO_DESIGN_MODE_PROBABILITY = 0.65;

/** Stable per page load (module init), including React StrictMode remounts. */
export const heroShowsDesignModeWindow = Math.random() < HERO_DESIGN_MODE_PROBABILITY;

/** Matches the `spirit-collapsible-down` duration in `styles.css`. */
export const COLLAPSIBLE_OPEN_ANIMATION_MS = 280;

/** Matches the `spirit-collapsible-up` duration in `styles.css`. */
export const COLLAPSIBLE_CLOSE_ANIMATION_MS = 220;

/** Unmount heavy content (Monaco etc.) only after the close animation ends, so the animation never exposes a blank area. */
export const COLLAPSIBLE_CLOSE_UNMOUNT_DELAY_MS = COLLAPSIBLE_CLOSE_ANIMATION_MS + 32;

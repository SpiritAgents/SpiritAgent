/** Shared max width for landing and docs frames. */
export const SITE_FRAME_CLASS = "w-full max-w-(--site-frame-width)";

/**
 * When false, `/docs` is a coming-soon marketing page and nav/footer use the
 * site chrome (no Fumadocs search or sidebar mega). Flip when `content/docs`
 * has published MDX again.
 */
export const HAS_PUBLISHED_DOCS = true;

/** Docs shell: same max width as the landing frame. */
export const DOCS_FRAME_CLASS = `${SITE_FRAME_CLASS} mx-auto`;

/**
 * Below Tailwind `md`. Nav hides Features / Resources and the compact mega
 * carries them under Explore — phones, not iPad portrait.
 */
export const SITE_NAV_COMPACT_QUERY = "(width < 768px)";
export const SITE_NAV_COMPACT_COLLAPSE_QUERY = "(min-width: 768px)";

/**
 * Below Tailwind `lg`. Docs hide the page-tree sidebar and use the nav menu
 * button instead — includes iPad 11 portrait (~820px) where the sidebar is tight
 * but Features / Resources still fit in the bar.
 */
export const DOCS_SIDEBAR_DRAWER_QUERY = "(width < 1024px)";
export const DOCS_SIDEBAR_DRAWER_COLLAPSE_QUERY = "(min-width: 1024px)";

/** Portal target in SiteNav for the compact mega panel (docs tree + Explore, or Explore only). */
export const DOCS_MOBILE_MEGA_ROOT_ID = "docs-mobile-mega-root";

/** Nav docs-menu button toggles the compact mega (listener lives under DocsLayout). */
export const DOCS_MOBILE_MEGA_TOGGLE_EVENT = "spirit-docs-mobile-mega-toggle";

let docsMegaTogglePending = false;

export function requestDocsMegaToggle() {
  docsMegaTogglePending = true;
  window.dispatchEvent(new Event(DOCS_MOBILE_MEGA_TOGGLE_EVENT));
}

export function consumeDocsMegaToggleIfPending() {
  if (!docsMegaTogglePending) return false;
  docsMegaTogglePending = false;
  return true;
}

/** Shared by SiteNav mega menus and the docs mobile mega panel. */
export const SITE_MEGA_PANEL_DURATION_MS = 400;
export const SITE_MEGA_PANEL_HEIGHT_TRANSITION = `height ${SITE_MEGA_PANEL_DURATION_MS}ms cubic-bezier(0.32,0.72,0.24,1)`;

export const SITE_NAV_MENU_OPEN_EVENT = "spirit-site-nav-menu-open";
export const DOCS_MOBILE_MEGA_OPEN_EVENT = "spirit-docs-mobile-mega-open";
export const DOCS_MOBILE_MEGA_CLOSE_EVENT = "spirit-docs-mobile-mega-close";

/** Feature sections use the same site frame so landing and docs share one max width. */
export const LANDING_FEATURE_FRAME_CLASS = SITE_FRAME_CLASS;

/** Text + desktop window split; favors the preview column on large screens. */
export const LANDING_FEATURE_GRID_CLASS =
  "grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center";

/** Window frame height for landing feature desktop demos. */
export const LANDING_DESKTOP_WINDOW_FRAME_CLASS =
  "h-[min(84vh,46rem)] min-h-[36rem] @min-[80rem]:h-[min(84vh,52rem)] @min-[80rem]:min-h-[40rem]";

/** Hero demo frame — default matches landing demos; only on wide layouts nudges height so 1440p hints at scroll. */
export const HERO_DESKTOP_WINDOW_FRAME_CLASS =
  "h-[min(84vh,46rem)] min-h-[36rem] @min-[80rem]:h-[min(86vh,58rem)] @min-[80rem]:min-h-[40rem]";

export const LANDING_DESKTOP_WINDOW_VIEWPORT_CLASS = "h-full min-h-0";

/** Shared surface for landing gray demo boxes. */
const LANDING_FEATURE_DEMO_BOX_SURFACE_CLASS =
  "overflow-hidden rounded-[4px] bg-muted dark:bg-[#111111]";

/** 1px inset ring on top of demo content — same tone as the frame so crop edges read against the page. */
export const LANDING_FEATURE_DEMO_BOX_INSET_BORDER_CLASS =
  "pointer-events-none absolute inset-0 z-10 rounded-[4px] shadow-[inset_0_0_0_1px_var(--muted)] dark:shadow-[inset_0_0_0_1px_#111111]";

/** Landing feature demo outer shell — same footprint as the bare window it replaces. */
export const LANDING_FEATURE_DEMO_BOX_FRAME_CLASS = `relative h-[34rem] min-h-[34rem] ${LANDING_FEATURE_DEMO_BOX_SURFACE_CLASS}`;

/** Shorter demo shell for trio feature columns. */
export const LANDING_TRIO_DEMO_BOX_FRAME_CLASS = `relative h-[20rem] min-h-[20rem] ${LANDING_FEATURE_DEMO_BOX_SURFACE_CLASS}`;

export const LANDING_FEATURE_DEMO_BOX_INNER_CLASS =
  "relative flex h-full min-h-0 flex-col p-5 sm:p-6";

/** Box above, copy below — three feature previews in one row. */
export const LANDING_TRIO_GRID_CLASS = "grid gap-10 sm:gap-12 lg:grid-cols-3 lg:gap-8";

/** Window left, text right; preview column still gets the wider track. */
export const LANDING_FEATURE_GRID_REVERSED_CLASS =
  "grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-center";

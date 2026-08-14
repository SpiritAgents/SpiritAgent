type MediaRange = {
  type: string;
  subtype: string;
  q: number;
};

const HTML = "text/html";
const MARKDOWN = "text/markdown";

function parseAcceptHeader(acceptHeader: string | null): MediaRange[] {
  if (!acceptHeader?.trim()) {
    return [{ type: "*", subtype: "*", q: 1 }];
  }

  const ranges: MediaRange[] = [];

  for (const part of acceptHeader.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const [mediaRange, ...params] = trimmed.split(";").map((segment) => segment.trim());
    const [type, subtype = "*"] = mediaRange.split("/");
    if (!type) continue;

    let q = 1;
    for (const param of params) {
      const [key, value] = param.split("=").map((segment) => segment.trim());
      if (key === "q" && value) {
        const parsed = Number.parseFloat(value);
        if (!Number.isNaN(parsed)) {
          q = parsed;
        }
      }
    }

    ranges.push({ type: type.toLowerCase(), subtype: subtype.toLowerCase(), q });
  }

  if (ranges.length === 0) {
    return [{ type: "*", subtype: "*", q: 1 }];
  }

  return ranges.sort((left, right) => {
    if (right.q !== left.q) return right.q - left.q;
    const leftSpecificity = specificity(left);
    const rightSpecificity = specificity(right);
    return rightSpecificity - leftSpecificity;
  });
}

function specificity(range: MediaRange): number {
  if (range.type === "*" && range.subtype === "*") return 0;
  if (range.subtype === "*") return 1;
  return 2;
}

function matches(range: MediaRange, type: string, subtype: string): boolean {
  const typeMatches = range.type === "*" || range.type === type;
  const subtypeMatches = range.subtype === "*" || range.subtype === subtype;
  return typeMatches && subtypeMatches;
}

function effectiveQ(ranges: MediaRange[], type: string, subtype: string): number {
  let best = -1;
  for (const range of ranges) {
    if (matches(range, type, subtype)) {
      best = Math.max(best, range.q);
    }
  }
  return best;
}

export function prefersMarkdown(acceptHeader: string | null): boolean {
  const ranges = parseAcceptHeader(acceptHeader);
  const markdownQ = effectiveQ(ranges, "text", "markdown");
  const htmlQ = effectiveQ(ranges, "text", "html");

  if (markdownQ >= 0 && htmlQ >= 0) {
    return markdownQ > htmlQ;
  }

  if (markdownQ >= 0) {
    return true;
  }

  return false;
}

export function acceptsOnlyMarkdown(acceptHeader: string | null): boolean {
  const ranges = parseAcceptHeader(acceptHeader);
  return ranges.length > 0 && ranges.every((range) => matches(range, "text", "markdown"));
}

function normalizePathname(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

export function resolveMarkdownCompanionPath(pathname: string): string | null {
  const normalized = normalizePathname(pathname);

  if (normalized === "/en-US" || normalized === "/zh-CN") {
    return `${normalized}/index.md`;
  }

  if (normalized === "/en-US/download" || normalized === "/zh-CN/download") {
    return `${normalized}/index.md`;
  }

  return null;
}

export function markdownPageForPath(pathname: string): "home" | "download" | null {
  const normalized = normalizePathname(pathname);
  if (normalized === "/en-US/download" || normalized === "/zh-CN/download") {
    return "download";
  }
  if (normalized === "/en-US" || normalized === "/zh-CN") {
    return "home";
  }
  return null;
}

export function localeFromLocalizedPath(pathname: string): "en-US" | "zh-CN" | null {
  const locale = normalizePathname(pathname).split("/").filter(Boolean)[0];
  return locale === "en-US" || locale === "zh-CN" ? locale : null;
}

type LanguageTag = {
  tag: string;
  q: number;
  order: number;
};

function parseAcceptLanguage(acceptLanguage: string | null): LanguageTag[] {
  if (!acceptLanguage?.trim()) {
    return [];
  }

  return acceptLanguage
    .split(",")
    .map((part, order) => {
      const trimmed = part.trim();
      const [tagPart, ...params] = trimmed.split(";").map((segment) => segment.trim());
      let q = 1;

      for (const param of params) {
        const [key, value] = param.split("=").map((segment) => segment.trim());
        if (key === "q" && value) {
          const parsed = Number.parseFloat(value);
          if (!Number.isNaN(parsed)) {
            q = parsed;
          }
        }
      }

      return { tag: tagPart.toLowerCase(), q, order };
    })
    .sort((left, right) => {
      if (right.q !== left.q) return right.q - left.q;
      return left.order - right.order;
    });
}

function localeFromLanguageTag(tag: string): "en-US" | "zh-CN" {
  return tag.startsWith("zh") ? "zh-CN" : "en-US";
}

export function detectLocaleFromAcceptLanguage(acceptLanguage: string | null): "en-US" | "zh-CN" {
  const tags = parseAcceptLanguage(acceptLanguage);
  if (tags.length === 0) {
    return "en-US";
  }

  return localeFromLanguageTag(tags[0].tag);
}

export { HTML, MARKDOWN };

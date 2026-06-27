const TIME_UNITS: ReadonlyArray<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: 'year', seconds: 60 * 60 * 24 * 365 },
  { unit: 'month', seconds: 60 * 60 * 24 * 30 },
  { unit: 'week', seconds: 60 * 60 * 24 * 7 },
  { unit: 'day', seconds: 60 * 60 * 24 },
  { unit: 'hour', seconds: 60 * 60 },
  { unit: 'minute', seconds: 60 },
  { unit: 'second', seconds: 1 },
];

function resolveRelativeTimeLocale(locale: string): string {
  const normalized = locale.trim().toLowerCase();
  if (normalized.startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en';
}

/** Intl zh-CN 相对时间默认无空格（如 3分钟前）；与 PR 时间线等 UI 文案统一为「3 分钟前」。 */
function addZhRelativeTimeSpaces(text: string): string {
  return text.replace(/(\d)([\u4e00-\u9fff])/g, '$1 $2');
}

export function formatRelativeTime(isoTimestamp: string, locale: string): string {
  const parsed = Date.parse(isoTimestamp);
  if (!Number.isFinite(parsed)) {
    return isoTimestamp;
  }

  const resolvedLocale = resolveRelativeTimeLocale(locale);
  const deltaSeconds = Math.round((parsed - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(resolvedLocale, {
    numeric: 'auto',
  });

  for (const { unit, seconds } of TIME_UNITS) {
    if (Math.abs(deltaSeconds) >= seconds || unit === 'second') {
      const value = Math.round(deltaSeconds / seconds);
      const formatted = formatter.format(value, unit);
      return resolvedLocale.startsWith('zh') ? addZhRelativeTimeSpaces(formatted) : formatted;
    }
  }

  return isoTimestamp;
}

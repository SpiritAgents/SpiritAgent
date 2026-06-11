import type { TFunction } from 'i18next';

import {
  PROCESS_TOOL_CATEGORY_ORDER,
  type ProcessToolCategory,
  type ProcessToolCounts,
} from '@/lib/process-tool-category';

export const PROCESS_SUMMARY_MAX_VISIBLE_CATEGORIES = 3;

const CATEGORY_I18N_KEY: Record<ProcessToolCategory, string> = {
  view: 'process.viewed',
  create: 'process.created',
  edit: 'process.edited',
  delete: 'process.deleted',
  ask: 'process.asked',
  diagnose: 'process.diagnosed',
  generate: 'process.generated',
  other: 'process.other',
};

export function formatProcessCategoryLabel(
  t: TFunction,
  category: ProcessToolCategory,
  count: number,
): string {
  return t(CATEGORY_I18N_KEY[category], { count });
}

export function formatProcessSummary(
  t: TFunction,
  counts: ProcessToolCounts,
  maxVisibleCategories = PROCESS_SUMMARY_MAX_VISIBLE_CATEGORIES,
): string {
  const activeCategories = PROCESS_TOOL_CATEGORY_ORDER.filter((category) => counts[category] > 0);
  if (activeCategories.length === 0) {
    return '';
  }

  const visibleCategories = activeCategories.slice(0, maxVisibleCategories);
  const labels = visibleCategories.map((category) =>
    formatProcessCategoryLabel(t, category, counts[category]),
  );
  const summary = labels.join(t('process.separator'));

  if (activeCategories.length > maxVisibleCategories) {
    return `${summary}${t('process.separator')}${t('process.andMore')}`;
  }

  return summary;
}
